import colyseus from 'colyseus';
const { Room } = colyseus;
import type { Client } from 'colyseus';
import { GameState, Character } from '../schema/GameState.js';
import { CHARACTERS } from '../../../shared/src/constants/characterData.js';
import { AuthService } from '../services/AuthService.js';

export class AutoChessRoom extends Room<GameState> {
  maxClients = 8;

  onCreate(options: any) {
    console.log('AutoChessRoom created!', options);

    // Initialize game state
    this.setState(new GameState());

    // Set game loop interval (50ms = 20 ticks per second)
    this.setSimulationInterval((deltaTime) => this.update(deltaTime), 50);

    // Handle game messages
    this.onMessage('buy_character', (client, message) => {
      const { characterId } = message;
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      // Check if bench is full
      if (player.bench.length >= 10) {
        console.log(`⚠️ Player ${player.username} bench is full`);
        client.send('error', { message: 'Bench is full' });
        return;
      }

      // Find the character data
      const characterData = CHARACTERS.find(c => c.id === characterId);
      if (!characterData) {
        console.error(`❌ Character ${characterId} not found`);
        return;
      }

      // Validate player has enough gold
      if (player.gold < characterData.cost) {
        console.log(`⚠️ Player ${player.username} doesn't have enough gold (has ${player.gold}, needs ${characterData.cost})`);
        client.send('error', { message: 'Not enough gold' });
        return;
      }

      // Deduct gold
      player.gold -= characterData.cost;

      // Create character instance
      const character = new Character();
      character.id = characterData.id;
      character.name = characterData.name;
      character.cost = characterData.cost;
      character.rarity = characterData.rarity;
      character.attack = characterData.attack;
      character.defense = characterData.defense;
      character.hp = characterData.hp;
      character.stars = 1;

      // Add to player's bench
      player.bench.push(character);

      console.log(`✅ Player ${player.username} bought ${character.name} for ${characterData.cost} gold. Remaining gold: ${player.gold}, Bench: ${player.bench.length}/10`);
    });

    this.onMessage('move_character', (client, message) => {
      console.log('Player wants to move character:', message);
      // TODO: Implement move character logic
    });

    this.onMessage('ready', (client) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      // Toggle ready status
      player.isReady = !player.isReady;
      console.log(`${player.isReady ? '✅' : '⏸️'} Player ${player.username} is ${player.isReady ? 'ready' : 'not ready'}`);

      // Check if all players are ready
      const allReady = this.checkAllPlayersReady();

      if (allReady && this.state.players.size >= 1) { // Minimum 1 player for testing (change to 8 for production)
        console.log('🎮 All players ready! Starting game...');
        this.startGame();
      }
    });
  }

  /**
   * Authenticate player before allowing them to join
   * This is called before onJoin
   */
  async onAuth(client: Client, options: any) {
    const token = options.token;

    // Allow joining without token (for backward compatibility during development)
    if (!token) {
      console.log(`⚠️ Player ${client.sessionId} joining without authentication`);
      return {
        userId: 0,
        username: `Guest_${client.sessionId.substring(0, 4)}`,
        displayName: `Guest_${client.sessionId.substring(0, 4)}`,
      };
    }

    try {
      // Verify JWT token
      const decoded = AuthService.verifyAccessToken(token);

      // Check if this userId is already in the room
      let userAlreadyConnected = false;
      this.state.players.forEach((player) => {
        if (player.userId === decoded.userId && player.userId !== 0) {
          userAlreadyConnected = true;
        }
      });

      if (userAlreadyConnected) {
        console.log(`❌ User ${decoded.username} (ID: ${decoded.userId}) is already in the room`);
        throw new Error('You are already connected to this game room');
      }

      console.log(`✅ Authenticated user: ${decoded.username} (ID: ${decoded.userId})`);

      // Return user data to be used in onJoin
      return {
        userId: decoded.userId,
        username: decoded.username,
        displayName: decoded.displayName,
      };
    } catch (error: any) {
      console.error(`❌ Authentication failed for ${client.sessionId}:`, error.message);
      throw new Error(error.message || 'Invalid authentication token');
    }
  }

  onJoin(client: Client, options: any, auth: any) {
    console.log(`✅ Player ${client.sessionId} joined!`, { displayName: auth.displayName, userId: auth.userId });

    // Add player to game state with authenticated user data
    this.state.addPlayer(client.sessionId, auth.displayName, auth.userId);

    // Generate initial shop for the player
    const characterIds = CHARACTERS.map(c => c.id);
    this.state.generateShopForPlayer(client.sessionId, characterIds);

    console.log(`👥 Total players: ${this.state.players.size}/8`);
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`👋 Player ${client.sessionId} left! (consented: ${consented})`);

    // Remove player from game state
    this.state.removePlayer(client.sessionId);

    console.log(`👥 Total players: ${this.state.players.size}/8`);
  }

  onDispose() {
    console.log('Room disposed!');
    // Cleanup logic here
  }

  update(deltaTime: number) {
    // Game loop - runs 20 times per second
    // TODO: Implement game logic updates
    // - Update timer
    // - Check phase transitions
    // - Simulate combat
  }

  // Check if all players are ready
  checkAllPlayersReady(): boolean {
    if (this.state.players.size === 0) return false;

    let allReady = true;
    this.state.players.forEach((player) => {
      if (!player.isReady) {
        allReady = false;
      }
    });

    return allReady;
  }

  // Start the game when all players are ready
  startGame() {
    console.log('🚀 Game starting!');

    // Change phase to PREPARATION
    this.state.phase = 'PREPARATION';
    this.state.roundNumber = 1;
    this.state.timer = 30;

    // Reset all players' ready status
    this.state.players.forEach((player) => {
      player.isReady = false;
    });

    // Broadcast game start message to all clients
    this.broadcast('game_started', {
      message: 'Game has started!',
      phase: this.state.phase,
    });

    console.log('✅ Game started successfully!');
  }
}
