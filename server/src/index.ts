import colyseus from 'colyseus';
const { Server, matchMaker } = colyseus;
import wsTransport from '@colyseus/ws-transport';
const { WebSocketTransport } = wsTransport;
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { AutoChessRoom } from './rooms/AutoChessRoom.js';
import { initializeDatabase, closeDatabase } from './database/Db.js';
import authRoutes from './routes/AuthRoutes.js';
import { userRepository } from './database/UserRepository.js';
import { characterService } from './services/CharacterService.js';

const port = Number(process.env.PORT || 2567);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);

// Get all characters (for client cache)
app.get('/api/characters', (req, res) => {
  const characters = characterService.getAllCharacters();
  res.json({ characters });
});

// PHASE 2A: Room mapping API - find new room ID after server restart
app.get('/api/game/room-mapping/:oldRoomId', async (req, res) => {
  try {
    const { oldRoomId } = req.params;
    console.log(`🔍 Room mapping request for old room: ${oldRoomId}`);

    const { gameStateSnapshotService } = await import('./services/GameStateSnapshotService.js');
    const newRoomId = await gameStateSnapshotService.getNewRoomIdByOldRoomId(oldRoomId);

    if (newRoomId) {
      console.log(`✅ Found mapping: ${oldRoomId} → ${newRoomId}`);
      res.json({
        success: true,
        oldRoomId,
        newRoomId,
      });
    } else {
      console.log(`❌ No mapping found for room: ${oldRoomId}`);
      res.status(404).json({
        success: false,
        error: 'Room not found or expired',
      });
    }
  } catch (error) {
    console.error('❌ Room mapping error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get room mapping',
    });
  }
});
// Create HTTP server
const httpServer = createServer(app);

// Create Colyseus server
const gameServer = new Server({
  transport: new WebSocketTransport({
    server: httpServer,
  }),
});

// Register game room
gameServer.define('auto_chess', AutoChessRoom);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database schema
    await initializeDatabase();

    // Initialize character service cache
    await characterService.initialize();

    // Start server FIRST to ensure MatchMaker is ready
    await gameServer.listen(port);
    console.log(`🎮 Auto Chess Arena Server listening on http://localhost:${port}`);

    // PHASE 1C: Recover active game rooms from database (after server is listening)
    const { gameStateSnapshotService } = await import('./services/GameStateSnapshotService.js');
    const activeSessions = await gameStateSnapshotService.getActiveSessions();

    if (activeSessions.length > 0) {
      console.log(`\n🔄 RECOVERY: Found ${activeSessions.length} active game session(s) to recover...\n`);

      for (const session of activeSessions) {
        try {
          const oldRoomId = session.room_id;
          const snapshotData = session.game_state_json;

          console.log(`   Recovering room ${oldRoomId}...`);

          // Create new room in recovery mode using MatchMaker
          const roomListing = await matchMaker.createRoom('auto_chess', {
            recover: true,
            snapshotData: snapshotData,
          });

          // Update room ID mapping (old → new)
          await gameStateSnapshotService.updateRoomIdMapping(session.id, oldRoomId, roomListing.roomId);

          console.log(`   ✅ Room recovered: ${oldRoomId} → ${roomListing.roomId}`);
        } catch (error) {
          console.error(`   ❌ Failed to recover session ${session.id}:`, error);
          // Mark session as inactive if recovery failed
          await gameStateSnapshotService.markSessionInactive(session.id);
        }
      }

      console.log(`\n✅ Recovery complete! ${activeSessions.length} room(s) restored.\n`);
    } else {
      console.log('✅ No active sessions to recover.');
    }

    // Clean up expired tokens periodically (every hour)
    setInterval(async () => {
      await userRepository.cleanupExpiredTokens();
    }, 60 * 60 * 1000);

    // Clean up expired game sessions periodically (every 10 minutes)
    setInterval(async () => {
      await gameStateSnapshotService.cleanupExpiredSessions();
    }, 10 * 60 * 1000);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
});

// Start the server
startServer();
