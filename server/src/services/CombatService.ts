import { ICombatResult, ICombatEvent, CombatEventType } from '../../../shared/src/types/game.types';
import { Character } from '../schema/GameState';

/**
 * Combat Unit - Runtime state during combat simulation
 */
interface CombatUnit {
  id: string;              // Unique instance ID
  characterId: string;     // Reference to character template
  name: string;
  currentHP: number;       // Changes during combat
  maxHP: number;           // Original HP
  attack: number;
  defense: number;
  speed: number;           // Attack speed (determines attack frequency)
  cost: number;            // Character cost (for damage calculation)
  position: { row: number; col: number };
  ownerId: string;         // Which player owns this unit
  isAlive: boolean;
  lastAttackTime: number;  // Timestamp of last attack (for speed-based attacks)
}

/**
 * Combat Matchup - Pair of players fighting
 */
interface CombatMatchup {
  player1Id: string;
  player2Id: string;
}

/**
 * Player Combat History - Tracks last opponents
 */
interface PlayerHistory {
  playerId: string;
  lastOpponents: string[];  // Last 2 opponent IDs
}

/**
 * CombatService - Handles all combat simulation logic
 */
export class CombatService {
  // Track combat history for matchmaking pool
  private playerHistories: Map<string, PlayerHistory> = new Map();

  constructor() {
    console.log('🗡️ CombatService initialized');
  }

  /**
   * Step 2: Create matchup pools based on opponent history
   * Rules:
   * - Cannot fight same opponent from last 2 rounds
   * - Pool resets when player is eliminated
   * - Random selection from available pool
   * - Handle odd number of players (one gets bye)
   */
  createMatchups(playerIds: string[], roundNumber: number, playerNames?: Map<string, string>): { matchups: CombatMatchup[], byePlayerId: string | null } {
    const matchups: CombatMatchup[] = [];
    const availablePlayers = [...playerIds];
    let byePlayerId: string | null = null;

    console.log(`\n⚔️ Creating matchups for Round ${roundNumber}`);
    console.log(`📋 Available players: ${availablePlayers.length}`);

    // Shuffle players for randomization
    this.shuffleArray(availablePlayers);

    // Create matchups
    while (availablePlayers.length >= 2) {
      const player1Id = availablePlayers.shift()!;

      // Find valid opponent from pool (not in last 2 opponents)
      const validOpponentIndex = this.findValidOpponent(player1Id, availablePlayers);

      if (validOpponentIndex !== -1) {
        // Found valid opponent
        const player2Id = availablePlayers.splice(validOpponentIndex, 1)[0];
        matchups.push({ player1Id, player2Id });

        // Update histories (pass total player count)
        this.updatePlayerHistory(player1Id, player2Id, playerIds.length);
        this.updatePlayerHistory(player2Id, player1Id, playerIds.length);

        const player1Name = playerNames?.get(player1Id) || player1Id;
        const player2Name = playerNames?.get(player2Id) || player2Id;
        console.log(`🤝 Matchup: ${player1Name} vs ${player2Name}`);
      } else {
        // No valid opponent found, try to pair with anyone (fallback)
        if (availablePlayers.length > 0) {
          const player2Id = availablePlayers.shift()!;
          matchups.push({ player1Id, player2Id });

          this.updatePlayerHistory(player1Id, player2Id, playerIds.length);
          this.updatePlayerHistory(player2Id, player1Id, playerIds.length);

          const player1Name = playerNames?.get(player1Id) || player1Id;
          const player2Name = playerNames?.get(player2Id) || player2Id;
          console.log(`🤝 Matchup (fallback): ${player1Name} vs ${player2Name}`);
        } else {
          // Odd player, gets bye round
          const player1Name = playerNames?.get(player1Id) || player1Id;
          console.log(`🛡️ Player ${player1Name} gets a BYE round (no combat)`);
          availablePlayers.push(player1Id); // Put back for bye handling
          break;
        }
      }
    }

    // Handle remaining player (bye round)
    if (availablePlayers.length === 1) {
      byePlayerId = availablePlayers[0];
      const byePlayerName = playerNames?.get(byePlayerId) || byePlayerId;
      console.log(`💤 Player ${byePlayerName} gets a REST round`);

      // Clear their history so they can fight anyone next round
      this.resetPlayerHistory(byePlayerId);
    }

    console.log(`✅ Created ${matchups.length} matchups\n`);
    return { matchups, byePlayerId };
  }

  /**
   * Find a valid opponent from available pool
   * Returns index of valid opponent, or -1 if none found
   */
  private findValidOpponent(playerId: string, availablePlayers: string[]): number {
    const history = this.playerHistories.get(playerId);

    if (!history) {
      // No history, any opponent is valid
      return 0;
    }

    // Find first player not in last 2 opponents
    for (let i = 0; i < availablePlayers.length; i++) {
      const potentialOpponent = availablePlayers[i];

      if (!history.lastOpponents.includes(potentialOpponent)) {
        return i;
      }
    }

    return -1; // No valid opponent found
  }

  /**
   * Update player's opponent history with dynamic limit based on player count
   * - 6+ players: keep last 2 opponents
   * - 3-5 players: keep last 1 opponent
   */
  private updatePlayerHistory(playerId: string, opponentId: string, totalPlayers: number): void {
    let history = this.playerHistories.get(playerId);

    if (!history) {
      history = {
        playerId,
        lastOpponents: []
      };
      this.playerHistories.set(playerId, history);
    }

    // Add opponent to history
    history.lastOpponents.push(opponentId);

    // Determine history limit based on player count
    // 6+ players: keep last 2 opponents
    // 3-5 players: keep last 1 opponent
    // 2 players: no limit needed (always fight same person)
    const historyLimit = totalPlayers >= 6 ? 2 : 1;

    // Keep only last N opponents
    while (history.lastOpponents.length > historyLimit) {
      history.lastOpponents.shift();
    }
  }

  /**
   * Reset player's combat history (when eliminated or stage changes)
   */
  resetPlayerHistory(playerId: string): void {
    this.playerHistories.delete(playerId);
    console.log(`🔄 Reset combat history for player ${playerId}`);
  }

  /**
   * Reset all combat histories (for new stage or game reset)
   */
  resetAllHistories(): void {
    this.playerHistories.clear();
    console.log('🔄 Reset all combat histories');
  }

  /**
   * Utility: Shuffle array in place (Fisher-Yates)
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // Placeholder methods for future steps
  simulateCombat(player1Id: string, player2Id: string): ICombatResult {
    // TODO: Step 7 - Implement combat loop
    throw new Error('Not implemented yet');
  }
}

// Export singleton instance
export const combatService = new CombatService();
