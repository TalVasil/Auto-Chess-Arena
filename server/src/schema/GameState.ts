import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';
import { combatService } from '../services/CombatService.js';

export enum GamePhase {
  WAITING = 'WAITING',
  PREPARATION = 'PREPARATION',
  COMBAT = 'COMBAT',
  GAME_END = 'GAME_END',
}

/**
 * Character instance in a player's collection
 * Represents a character that a player owns (on bench or board)
 */
export class Character extends Schema {
  @type('string') id: string = ''; // Character type ID (e.g., 'archer_1', 'mage_1')
  @type('string') name: string = ''; // Display name
  @type('string') emoji: string = ''; // Visual icon
  @type('number') cost: number = 0; // Gold cost to purchase
  @type('string') rarity: string = ''; // COMMON, UNCOMMON, RARE, EPIC, LEGENDARY
  @type('number') attack: number = 0;
  @type('number') defense: number = 0;
  @type('number') hp: number = 0;
  @type('number') currentHP: number = 0; // Current HP in combat (syncs to client)
  @type('number') speed: number = 100; // Attack frequency (higher = faster)
  @type('number') stars: number = 1; // Upgrade level (1-3 stars)
}

/**
 * Position on the battle arena (8 rows x 9 columns)
 * Columns 0-3: Opponent side, Column 4: Neutral, Columns 5-8: Player side
 */
export class BoardPosition extends Schema {
  @type('number') row: number = 0; // 0-7
  @type('number') col: number = 0; // 0-8
  @type(Character) character: Character | undefined = undefined;
}

/**
 * Combat matchup pairing for a round
 * Contains both player IDs and display names for UI
 */
export class Matchup extends Schema {
  @type('string') player1Id: string = ''; // Colyseus session ID
  @type('string') player2Id: string = ''; // Colyseus session ID
  @type('string') player1Name: string = ''; // Display name for UI
  @type('string') player2Name: string = ''; // Display name for UI
}

/**
 * Player schema for game state synchronization
 *
 * IMPORTANT - Player has THREE different identifiers:
 * - id (string): Colyseus session ID - temporary, changes on reconnect, used for real-time game matching
 * - userId (number): Database user ID - permanent, never changes, used for stats/history/authentication
 * - username (string): Display name - what players see in-game, can be changed in profile
 */
export class Player extends Schema {
  @type('string') id: string = ''; // Colyseus session ID (temporary, changes on reconnect)
  @type('string') username: string = ''; // Display name shown in game
  @type('number') userId: number = 0; // Database user ID (permanent)
  @type('number') hp: number = 100;
  @type('number') gold: number = 0;
  @type('number') xp: number = 0;
  @type('number') level: number = 1;
  @type('boolean') isReady: boolean = false;
  @type('boolean') isEliminated: boolean = false;
  @type([Character]) bench = new ArraySchema<Character>();
  @type(['string']) shopCharacterIds = new ArraySchema<string>();
  @type([BoardPosition]) board = new ArraySchema<BoardPosition>();
}

/**
 * Main game state - automatically synchronized to all clients via Colyseus
 * Changes to this state are broadcast in real-time
 */
export class GameState extends Schema {
  @type('string') phase: GamePhase = GamePhase.WAITING; // Current game phase
  @type('number') roundNumber: number = 0; // Current round number
  @type('number') timer: number = 30; // Countdown timer for current phase (seconds)
  @type({ map: Player }) players = new MapSchema<Player>(); // All players in the game
  @type([Matchup]) currentMatchups = new ArraySchema<Matchup>(); // Combat pairings for current round

  addPlayer(sessionId: string, displayName: string, userId: number) {
    const player = new Player();
    player.id = sessionId;
    player.username = displayName; // Store display name in username field
    player.userId = userId;
    player.hp = 100;
    player.gold = 11; // Start with 10 gold for testing
    player.xp = 0;
    player.level = 1;
    this.players.set(sessionId, player);
  }

  generateShopForPlayer(sessionId: string, availableCharacterIds: string[]) {
    const player = this.players.get(sessionId);
    if (!player) return;

    // Clear existing shop
    player.shopCharacterIds.clear();

    // Randomly select 5 characters for the shop
    const shopSize = 5;
    const shuffled = [...availableCharacterIds].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(shopSize, shuffled.length); i++) {
      player.shopCharacterIds.push(shuffled[i]);
    }
  }

  /**
   * Regenerate shop for all players
   * Used when transitioning between rounds or resetting game
   */
  regenerateAllShops(availableCharacterIds: string[]) {
    this.players.forEach((_player, sessionId) => {
      this.generateShopForPlayer(sessionId, availableCharacterIds);
    });
  }

  removePlayer(sessionId: string) {
    this.players.delete(sessionId);
  }

  getAlivePlayersCount(): number {
    let count = 0;
    this.players.forEach((player) => {
      if (!player.isEliminated) count++;
    });
    return count;
  }

  generateMatchups(roundNumber: number): void {
    // Clear previous matchups
    this.currentMatchups.clear();

    // Get all alive player IDs and their names
    const alivePlayerIds: string[] = [];
    const playerNames = new Map<string, string>();
    this.players.forEach((player, sessionId) => {
      if (!player.isEliminated) {
        alivePlayerIds.push(sessionId);
        playerNames.set(sessionId, player.username);
      }
    });

    // Generate matchups using CombatService
    const matchupPairs = combatService.createMatchups(alivePlayerIds, roundNumber, playerNames);

    // Convert to Matchup schema objects with player names
    for (const pair of matchupPairs) {
      const matchup = new Matchup();
      matchup.player1Id = pair.player1Id;
      matchup.player2Id = pair.player2Id;

      // Get player names
      const player1 = this.players.get(pair.player1Id);
      const player2 = this.players.get(pair.player2Id);

      matchup.player1Name = player1?.username || 'Unknown';
      matchup.player2Name = player2?.username || 'Unknown';

      this.currentMatchups.push(matchup);
    }
  }
}
