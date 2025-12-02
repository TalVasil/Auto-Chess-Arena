import colyseus from 'colyseus';
const { Server } = colyseus;
import wsTransport from '@colyseus/ws-transport';
const { WebSocketTransport } = wsTransport;
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import { AutoChessRoom } from './rooms/AutoChessRoom.js';
import { initializeDatabase, closeDatabase } from './database/db.js';
import authRoutes from './routes/authRoutes.js';
import { userRepository } from './database/UserRepository.js';

const port = Number(process.env.PORT || 2567);
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);

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
app.get('/health', (req, res) => {
  res.json({ status: 'ok', players: gameServer.presence.channels.size });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database schema
    await initializeDatabase();

    // Clean up expired tokens periodically (every hour)
    setInterval(async () => {
      await userRepository.cleanupExpiredTokens();
    }, 60 * 60 * 1000);

    // Start server
    gameServer.listen(port);
    console.log(`🎮 Auto Chess Arena Server listening on http://localhost:${port}`);
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
