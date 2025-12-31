import { query } from '../database/db.js';
import { GameState } from '../schema/GameState.js';

/**
 * GameStateSnapshotService
 * Handles periodic snapshots of game state to database for recovery after server restarts
 */
class GameStateSnapshotService {
  private snapshotIntervals: Map<string, NodeJS.Timeout> = new Map();
  private readonly SNAPSHOT_INTERVAL_MS = 5000; // 5 seconds

  /**
   * Start periodic snapshots for a game room
   * Called from AutoChessRoom.onCreate()
   */
  startSnapshots(roomId: string, getState: () => GameState): void {
    // Clear existing timer if any
    this.stopSnapshots(roomId);

    console.log(`📸 Starting snapshots for room ${roomId} (interval: ${this.SNAPSHOT_INTERVAL_MS}ms)`);

    // Start periodic snapshots
    const intervalId = setInterval(async () => {
      try {
        const state = getState();

        // Skip empty rooms or rooms in waiting/lobby phase
        if (!state || state.players.size === 0 || state.phase === 'WAITING') {
          return;
        }

        // Serialize state to JSON
        const gameStateJson = this.serializeGameState(state);

        // Save to database
        await this.saveSnapshot(roomId, gameStateJson);
      } catch (error) {
        console.error(`❌ Failed to snapshot room ${roomId}:`, error);
      }
    }, this.SNAPSHOT_INTERVAL_MS);

    this.snapshotIntervals.set(roomId, intervalId);
  }

  /**
   * Stop periodic snapshots for a game room
   * Called from AutoChessRoom.onDispose()
   */
  stopSnapshots(roomId: string): void {
    const intervalId = this.snapshotIntervals.get(roomId);
    if (intervalId) {
      clearInterval(intervalId);
      this.snapshotIntervals.delete(roomId);
      console.log(`🛑 Stopped snapshots for room ${roomId}`);
    }
  }

  /**
   * Serialize Colyseus GameState schema to plain JSON object
   */
  private serializeGameState(state: GameState): string {
    // Build opponent mapping from current matchups for easier recovery
    const opponentMap = new Map<string, { opponentId: string; opponentName: string }>();
    Array.from(state.currentMatchups).forEach((matchup) => {
      opponentMap.set(matchup.player1Id, {
        opponentId: matchup.player2Id,
        opponentName: matchup.player2Name,
      });
      opponentMap.set(matchup.player2Id, {
        opponentId: matchup.player1Id,
        opponentName: matchup.player1Name,
      });
    });

    const plainState = {
      phase: state.phase,
      roundNumber: state.roundNumber,
      timer: state.timer,
      players: Array.from(state.players.entries()).map(([sessionId, player]) => {
        const opponentInfo = opponentMap.get(sessionId);
        return {
          id: player.id,
          sessionId: sessionId,
          username: player.username,
          userId: player.userId,
          hp: player.hp,
          gold: player.gold,
          xp: player.xp,
          level: player.level,
          isReady: player.isReady,
          isEliminated: player.isEliminated,
          bench: Array.from(player.bench)
            .filter((char) => char !== undefined)
            .map((char) => this.serializeCharacter(char)),
          shopCharacterIds: Array.from(player.shopCharacterIds),
          board: Array.from(player.board)
            .filter((pos) => pos !== undefined)
            .map((pos) => this.serializeBoardPosition(pos)),
          // Include opponent info for combat phase recovery
          currentOpponentId: opponentInfo?.opponentId || null,
          currentOpponentName: opponentInfo?.opponentName || null,
        };
      }),
      currentMatchups: Array.from(state.currentMatchups).map((matchup) => ({
        player1Id: matchup.player1Id,
        player2Id: matchup.player2Id,
        player1Name: matchup.player1Name,
        player2Name: matchup.player2Name,
      })),
    };

    return JSON.stringify(plainState);
  }

  /**
   * Serialize a Character schema to plain object
   */
  private serializeCharacter(char: any): any {
    return {
      id: char.id,
      name: char.name,
      emoji: char.emoji,
      cost: char.cost,
      rarity: char.rarity,
      attack: char.attack,
      defense: char.defense,
      hp: char.hp,
      speed: char.speed,
      stars: char.stars,
    };
  }

  /**
   * Serialize a BoardPosition schema to plain object
   */
  private serializeBoardPosition(pos: any): any {
    return {
      row: pos.row,
      col: pos.col,
      character: pos.character ? this.serializeCharacter(pos.character) : null,
    };
  }

  /**
   * Save snapshot to database (UPSERT)
   */
  private async saveSnapshot(roomId: string, gameStateJson: string): Promise<void> {
    try {
      await query(
        `INSERT INTO game_sessions (room_id, game_state_json, last_updated_at, expires_at)
         VALUES ($1, $2, NOW(), NOW() + interval '30 minutes')
         ON CONFLICT (room_id) DO UPDATE SET
           game_state_json = $2,
           last_updated_at = NOW(),
           expires_at = NOW() + interval '30 minutes'`,
        [roomId, gameStateJson]
      );

      console.log(`💾 Snapshot saved for room ${roomId}`);
    } catch (error) {
      console.error(`❌ Failed to save snapshot for room ${roomId}:`, error);
      throw error;
    }
  }

  /**
   * Finalize a game session (mark as inactive)
   * Called when room is disposed
   */
  async finalizeSession(roomId: string): Promise<void> {
    try {
      // Delete the session immediately when game ends
      // We don't need to keep completed games in database
      await query(`DELETE FROM game_sessions WHERE room_id = $1`, [roomId]);
      console.log(`🗑️ Deleted completed game session for room ${roomId}`);
    } catch (error) {
      console.error(`❌ Failed to finalize session for room ${roomId}:`, error);
    }
  }

  /**
   * Get all active game sessions (for recovery on server restart)
   */
  async getActiveSessions(): Promise<any[]> {
    try {
      const result = await query(
        `SELECT id, room_id, game_state_json
         FROM game_sessions
         WHERE is_active = true AND expires_at > NOW()
         ORDER BY last_updated_at DESC
         LIMIT 20`,
        []
      );
      return result.rows;
    } catch (error) {
      console.error('❌ Failed to retrieve active sessions:', error);
      return [];
    }
  }

  /**
   * Mark a session as inactive (failed recovery)
   */
  async markSessionInactive(sessionId: number): Promise<void> {
    try {
      await query(`UPDATE game_sessions SET is_active = false WHERE id = $1`, [sessionId]);
      console.log(`⚠️ Marked session ${sessionId} as inactive (recovery failed)`);
    } catch (error) {
      console.error(`❌ Failed to mark session ${sessionId} as inactive:`, error);
    }
  }

  /**
   * Update room ID mapping after recovery (old room ID → new room ID)
   */
  async updateRoomIdMapping(sessionId: number, oldRoomId: string, newRoomId: string): Promise<void> {
    try {
      await query(`UPDATE game_sessions SET room_id = $1, old_room_id = $2 WHERE id = $3`, [
        newRoomId,
        oldRoomId,
        sessionId,
      ]);
      console.log(`🔗 Mapped room ID: ${oldRoomId} → ${newRoomId}`);
    } catch (error) {
      console.error(`❌ Failed to update room ID mapping:`, error);
    }
  }

  /**
   * Get new room ID by old room ID (for reconnection)
   */
  async getNewRoomIdByOldRoomId(oldRoomId: string): Promise<string | null> {
    try {
      const result = await query(
        `SELECT room_id FROM game_sessions WHERE old_room_id = $1 AND is_active = true AND expires_at > NOW()`,
        [oldRoomId]
      );
      if (result.rows.length > 0) {
        return result.rows[0].room_id;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to get new room ID by old room ID:', error);
      return null;
    }
  }

  /**
   * Clean up expired sessions (called periodically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const result = await query(`DELETE FROM game_sessions WHERE expires_at < NOW() AND is_active = false`, []);
      if (result.rowCount && result.rowCount > 0) {
        console.log(`🧹 Cleaned up ${result.rowCount} expired game sessions`);
      }
    } catch (error) {
      console.error('❌ Failed to cleanup expired sessions:', error);
    }
  }
}

// Export singleton instance
export const gameStateSnapshotService = new GameStateSnapshotService();
