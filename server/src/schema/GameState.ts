import { Schema, type, MapSchema, ArraySchema } from '@colyseus/schema';

export enum GamePhase {
  WAITING = 'WAITING',
  PREPARATION = 'PREPARATION',
  COMBAT = 'COMBAT',
  GAME_END = 'GAME_END',
}

export class Character extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('number') cost: number = 0;
  @type('string') rarity: string = '';
  @type('number') attack: number = 0;
  @type('number') defense: number = 0;
  @type('number') hp: number = 0;
  @type('number') stars: number = 1;
}

export class BoardPosition extends Schema {
  @type('number') row: number = 0;
  @type('number') col: number = 0;
  @type(Character) character: Character | undefined = undefined;
}

export class Player extends Schema {
  @type('string') id: string = '';
  @type('string') username: string = ''; // Display name shown in game
  @type('number') userId: number = 0; // Database user ID
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

export class GameState extends Schema {
  @type('string') phase: GamePhase = GamePhase.WAITING;
  @type('number') roundNumber: number = 0;
  @type('number') timer: number = 30;
  @type({ map: Player }) players = new MapSchema<Player>();

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
}
