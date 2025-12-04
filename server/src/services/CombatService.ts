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
  createMatchups(playerIds: string[], roundNumber: number): CombatMatchup[] {
    const matchups: CombatMatchup[] = [];
    const availablePlayers = [...playerIds];

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

        // Update histories
        this.updatePlayerHistory(player1Id, player2Id);
        this.updatePlayerHistory(player2Id, player1Id);

        console.log(`🤝 Matchup: ${player1Id} vs ${player2Id}`);
      } else {
        // No valid opponent found, try to pair with anyone (fallback)
        if (availablePlayers.length > 0) {
          const player2Id = availablePlayers.shift()!;
          matchups.push({ player1Id, player2Id });

          this.updatePlayerHistory(player1Id, player2Id);
          this.updatePlayerHistory(player2Id, player1Id);

          console.log(`🤝 Matchup (fallback): ${player1Id} vs ${player2Id}`);
        } else {
          // Odd player, gets bye round
          console.log(`🛡️ Player ${player1Id} gets a BYE round (no combat)`);
          availablePlayers.push(player1Id); // Put back for bye handling
          break;
        }
      }
    }

    // Handle remaining player (bye round)
    if (availablePlayers.length === 1) {
      console.log(`🛡️ Player ${availablePlayers[0]} gets a BYE round`);
    }

    console.log(`✅ Created ${matchups.length} matchups\n`);
    return matchups;
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
   * Update player's opponent history (keep last 2)
   */
  private updatePlayerHistory(playerId: string, opponentId: string): void {
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

    // Keep only last 2 opponents
    if (history.lastOpponents.length > 2) {
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
