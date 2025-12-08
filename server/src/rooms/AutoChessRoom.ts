import colyseus from 'colyseus';
const { Room } = colyseus;
import type { Client } from 'colyseus';
import { GameState, Character, BoardPosition } from '../schema/GameState.js';
import { CHARACTERS } from '../../../shared/src/constants/characterData.js';
import { AuthService } from '../services/AuthService.js';

export class AutoChessRoom extends Room<GameState> {
  maxClients = 8;
  private elapsedTime: number = 0; // Accumulator for timer countdown
  private timerPaused: boolean = false; // Debug flag to pause timer

  onCreate(options: any) {
    console.log('AutoChessRoom created!', options);

    // Enable reconnection - keep seat reserved for 5 minutes (300 seconds)
    this.setSeatReservationTime(300);

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

    // Sell character from bench - refunds gold
    this.onMessage('sell_character', (client, message: { benchIndex: number }) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      const { benchIndex } = message;

      // Validate bench index
      if (benchIndex < 0 || benchIndex >= player.bench.length) {
        console.log(`⚠️ Invalid bench index: ${benchIndex}`);
        client.send('error', { message: 'Invalid bench position' });
        return;
      }

      const character = player.bench[benchIndex];

      if (!character) {
        console.log(`⚠️ No character at bench index ${benchIndex}`);
        client.send('error', { message: 'No character at this position' });
        return;
      }

      // Refund gold (full cost)
      const refundAmount = character.cost;
      player.gold += refundAmount;

      // Remove character from bench
      player.bench.splice(benchIndex, 1);

      console.log(`💰 Player ${player.username} sold ${character.name} for ${refundAmount} gold. Total gold: ${player.gold}`);
    });

    // Reroll shop - costs 2 gold
    this.onMessage('reroll_shop', (client) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      const rerollCost = 2;

      // Check if player has enough gold
      if (player.gold < rerollCost) {
        console.log(`⚠️ Player ${player.username} doesn't have enough gold to reroll (has ${player.gold}, needs ${rerollCost})`);
        client.send('error', { message: 'Not enough gold to reroll' });
        return;
      }

      // Deduct gold
      player.gold -= rerollCost;

      // Regenerate shop
      const characterIds = CHARACTERS.map(c => c.id);
      this.state.generateShopForPlayer(client.sessionId, characterIds);

      console.log(`🔄 Player ${player.username} rerolled shop for ${rerollCost} gold. Remaining gold: ${player.gold}`);
    });

    // Place character from bench to board
    this.onMessage('place_character', (client, message: { benchIndex: number, row: number, col: number }) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      // Only allow placement during PREPARATION phase
      if (this.state.phase !== 'PREPARATION') {
        console.log(`⚠️ Player ${player.username} tried to place character during ${this.state.phase} phase`);
        client.send('error', { message: 'You can only place characters during preparation phase' });
        return;
      }

      const { benchIndex, row, col } = message;

      // Validate player can only place in their side (right 4 columns: col 5-8)
      if (col < 5 || col > 8) {
        console.log(`⚠️ Player ${player.username} tried to place character in invalid column ${col}. Must be 5-8 (player side).`);
        client.send('error', { message: 'You can only place characters on your side (green area)' });
        return;
      }

      // Validate row (0-7)
      if (row < 0 || row > 7) {
        console.log(`⚠️ Invalid row ${row}`);
        return;
      }

      // Validate bench index
      if (benchIndex < 0 || benchIndex >= player.bench.length) {
        console.error(`❌ Invalid bench index: ${benchIndex}`);
        return;
      }

      const character = player.bench[benchIndex];
      if (!character) {
        console.error(`❌ No character at bench index ${benchIndex}`);
        return;
      }

      // Check if position is already occupied
      const existingPos = player.board.find(pos => pos.row === row && pos.col === col);
      if (existingPos) {
        console.log(`⚠️ Position (${row}, ${col}) already occupied`);
        return;
      }

      // Add character to board
      const boardPos = new BoardPosition();
      boardPos.row = row;
      boardPos.col = col;
      boardPos.character = character;
      player.board.push(boardPos);

      // Remove from bench
      player.bench.splice(benchIndex, 1);

      console.log(`✅ Player ${player.username} placed ${character.name} at (${row}, ${col})`);
    });

    // Swap two characters on bench or move character to specific bench slot
    this.onMessage('swap_bench', (client, message: { fromIndex: number, toIndex: number }) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      const { fromIndex, toIndex } = message;

      // Validate indices
      if (fromIndex < 0 || fromIndex >= 10 || toIndex < 0 || toIndex >= 10) {
        console.log(`⚠️ Invalid bench indices: ${fromIndex}, ${toIndex}`);
        return;
      }

      const fromChar = player.bench[fromIndex];
      const toChar = player.bench[toIndex];

      if (!fromChar) {
        console.log(`⚠️ No character at source bench index ${fromIndex}`);
        return;
      }

      // If target slot is empty, just move the character
      if (!toChar) {
        // Remove from source
        player.bench.splice(fromIndex, 1);
        // Insert at target position
        player.bench.splice(toIndex, 0, fromChar);
        console.log(`✅ Player ${player.username} moved ${fromChar.name} from bench[${fromIndex}] to bench[${toIndex}]`);
      } else {
        // Swap the two characters
        player.bench[fromIndex] = toChar;
        player.bench[toIndex] = fromChar;
        console.log(`✅ Player ${player.username} swapped ${fromChar.name} ↔️ ${toChar.name}`);
      }
    });

    // Move character from board back to bench (with optional target slot)
    this.onMessage('remove_from_board', (client, message: { row: number, col: number, targetBenchIndex?: number }) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      // Only allow removal during PREPARATION phase
      if (this.state.phase !== 'PREPARATION') {
        console.log(`⚠️ Player ${player.username} tried to remove character during ${this.state.phase} phase`);
        client.send('error', { message: 'You can only move characters during preparation phase' });
        return;
      }

      const { row, col, targetBenchIndex } = message;

      // Find character at this position
      const posIndex = player.board.findIndex(pos => pos.row === row && pos.col === col);
      if (posIndex === -1) {
        console.log(`⚠️ No character at position (${row}, ${col})`);
        return;
      }

      const boardPos = player.board[posIndex];
      if (!boardPos.character) {
        console.log(`⚠️ No character at position (${row}, ${col})`);
        return;
      }

      // Check if bench has space (max 10)
      if (player.bench.length >= 10) {
        console.log(`⚠️ Player ${player.username} bench is full`);
        client.send('error', { message: 'Bench is full' });
        return;
      }

      // Move character back to bench
      if (targetBenchIndex !== undefined && targetBenchIndex >= 0 && targetBenchIndex <= player.bench.length) {
        // Insert at specific position
        player.bench.splice(targetBenchIndex, 0, boardPos.character);
        console.log(`✅ Player ${player.username} moved ${boardPos.character.name} from board to bench[${targetBenchIndex}]`);
      } else {
        // Append to end
        player.bench.push(boardPos.character);
        console.log(`✅ Player ${player.username} moved ${boardPos.character.name} from board to bench`);
      }

      // Remove from board
      player.board.splice(posIndex, 1);
    });

    // Move character between arena tiles
    this.onMessage('move_on_board', (client, message: { fromRow: number, fromCol: number, toRow: number, toCol: number }) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      // Only allow movement during PREPARATION phase
      if (this.state.phase !== 'PREPARATION') {
        console.log(`⚠️ Player ${player.username} tried to move character during ${this.state.phase} phase`);
        client.send('error', { message: 'You can only move characters during preparation phase' });
        return;
      }

      const { fromRow, fromCol, toRow, toCol } = message;

      // Validate target position is in player's side (col 5-8)
      if (toCol < 5 || toCol > 8) {
        console.log(`⚠️ Player ${player.username} tried to move to invalid column ${toCol}`);
        return;
      }

      // Validate row
      if (toRow < 0 || toRow > 7) {
        console.log(`⚠️ Invalid row ${toRow}`);
        return;
      }

      // Find character at source position
      const sourcePosIndex = player.board.findIndex(pos => pos.row === fromRow && pos.col === fromCol);
      if (sourcePosIndex === -1) {
        console.log(`⚠️ No character at source position (${fromRow}, ${fromCol})`);
        return;
      }

      const sourcePos = player.board[sourcePosIndex];
      if (!sourcePos.character) {
        console.log(`⚠️ No character at source position (${fromRow}, ${fromCol})`);
        return;
      }

      // Check if target position is occupied
      const targetPosIndex = player.board.findIndex(pos => pos.row === toRow && pos.col === toCol);
      if (targetPosIndex !== -1) {
        console.log(`⚠️ Target position (${toRow}, ${toCol}) already occupied`);
        return;
      }

      // Move character to new position
      sourcePos.row = toRow;
      sourcePos.col = toCol;

      console.log(`✅ Player ${player.username} moved ${sourcePos.character.name} from (${fromRow}, ${fromCol}) to (${toRow}, ${toCol})`);
    });

    // Debug: Toggle timer pause/resume
    this.onMessage('debug_toggle_timer', (client) => {
      this.timerPaused = !this.timerPaused;
      console.log(`🔧 DEBUG: Timer ${this.timerPaused ? 'PAUSED' : 'RESUMED'} by ${client.sessionId}`);
      this.broadcast('debug_message', { message: `Timer ${this.timerPaused ? 'paused' : 'resumed'}` });
    });

    // Debug: Toggle phase between PREPARATION and COMBAT
    this.onMessage('debug_toggle_phase', (client) => {
      if (this.state.phase === 'PREPARATION') {
        this.state.phase = 'COMBAT';
        this.state.timer = 30;
        this.elapsedTime = 0;
      } else if (this.state.phase === 'COMBAT') {
        // Transition to PREPARATION - increment round and give gold
        this.state.roundNumber++;
        this.state.phase = 'PREPARATION';
        this.state.timer = 30;
        this.elapsedTime = 0;

        // Give income and regenerate shops for all players
        this.state.players.forEach((player, sessionId) => {
          player.gold += 5;
          console.log(`💰 Player ${player.username} received 5 gold (total: ${player.gold})`);

          const characterIds = CHARACTERS.map(c => c.id);
          this.state.generateShopForPlayer(sessionId, characterIds);
        });
      }
      console.log(`🔧 DEBUG: Phase toggled to ${this.state.phase} by ${client.sessionId}`);
      this.broadcast('phase_changed', {
        phase: this.state.phase,
        roundNumber: this.state.roundNumber,
        message: `DEBUG: Phase toggled to ${this.state.phase}`,
      });
    });

    // Debug: Skip to next round
    this.onMessage('debug_next_round', (client) => {
      console.log(`🔧 DEBUG: Next round triggered by ${client.sessionId}`);

      // Force phase transition
      this.handlePhaseTransition();
    });

    // Debug: Reset game to round 1 preparation
    this.onMessage('debug_reset_game', (client) => {
      console.log(`🔧 DEBUG: Game reset by ${client.sessionId}`);

      // Reset to round 1 preparation
      this.state.phase = 'PREPARATION';
      this.state.roundNumber = 1;
      this.state.timer = 30;
      this.elapsedTime = 0;
      this.timerPaused = false;

      // Reset all players
      this.state.players.forEach((player, sessionId) => {
        player.hp = 100;
        player.gold = 11;
        player.xp = 0;
        player.level = 1;
        player.isEliminated = false;

        // Clear bench and board
        player.bench.clear();
        player.board.clear();

        // Regenerate shop
        const characterIds = CHARACTERS.map(c => c.id);
        this.state.generateShopForPlayer(sessionId, characterIds);
      });

      this.broadcast('game_reset', {
        message: 'Game has been reset!',
        phase: this.state.phase,
        roundNumber: this.state.roundNumber,
      });
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

    // Check if this player already exists (reconnection)
    const existingPlayer = this.state.players.get(client.sessionId);

    if (existingPlayer) {
      // RECONNECTION - player already exists in game
      console.log('✅ Player reconnected:', client.sessionId);
      console.log('   Restored state:', {
        username: existingPlayer.username,
        gold: existingPlayer.gold,
        hp: existingPlayer.hp,
        benchSize: existingPlayer.bench.length
      });

      // If game already started, need to resync game state
      if (this.state.phase !== 'WAITING') {
        console.log('   Reconnecting during', this.state.phase, 'phase');
        // The state sync happens automatically via Colyseus
        // Client will receive full state update on reconnection
      }

      // Player data is already in state, nothing to do!
      return;
    }

    // Check if this userId is already in the game (prevent multiple connections from same user)
    // BUT: Only block if the old connection is still active (not waiting for reconnection)
    const duplicatePlayer = Array.from(this.state.players.values()).find(
      (p) => p.userId === auth.userId
    );

    if (duplicatePlayer) {
      // Check if the old session is actually still connected
      const oldClient = this.clients.find((c) => c.sessionId === duplicatePlayer.id);

      if (oldClient) {
        // Old session is still ACTIVE - this is a duplicate connection attempt
        console.log(`⚠️ User ${auth.displayName} (ID: ${auth.userId}) is already connected with sessionId: ${duplicatePlayer.id}`);
        console.log('🚫 Rejecting duplicate connection');
        throw new Error('You are already connected to this game from another tab or device.');
      } else {
        // Old session is disconnected and waiting for reconnection
        // This is the same user trying to reconnect with a new sessionId (token expired)
        // Remove the old player data and let them join as new
        console.log(`🔄 User ${auth.displayName} (ID: ${auth.userId}) reconnection token expired, removing old session ${duplicatePlayer.id}`);
        this.state.removePlayer(duplicatePlayer.id);
      }
    }

    // NEW PLAYER - create new player data
    console.log('🆕 New player joining:', client.sessionId);

    // Add player to game state with authenticated user data
    this.state.addPlayer(client.sessionId, auth.displayName, auth.userId);

    // Generate initial shop for the player
    const characterIds = CHARACTERS.map(c => c.id);
    this.state.generateShopForPlayer(client.sessionId, characterIds);

    console.log(`👥 Total players: ${this.state.players.size}/8`);
  }

  async onLeave(client: Client, consented: boolean) {
    console.log(`👋 Player ${client.sessionId} left! (consented: ${consented})`);

    const player = this.state.players.get(client.sessionId);

    if (!player) {
      console.log('⚠️ Player not found in state');
      return;
    }

    // If consented = true, player clicked "Logout" (intentional)
    // If consented = false, it was accidental (browser close, network error)

    if (consented) {
      // Intentional disconnect - remove player immediately
      console.log('🚪 Player left intentionally, removing from game');
      this.state.removePlayer(client.sessionId);
    } else {
      // Accidental disconnect - keep player data for reconnection
      console.log('⏳ Player disconnected accidentally, keeping data for reconnection');

      // Allow reconnection for this client
      console.log('🔧 Calling allowReconnection() for:', client.sessionId);
      try {
        // Don't await - this returns a promise that resolves when player reconnects
        this.allowReconnection(client, 300).then(() => {
          console.log('✅ Player successfully reconnected:', client.sessionId);
        }).catch((error) => {
          // Reconnection window expired - remove player from game
          console.log('⏰ Reconnection window expired for:', client.sessionId);
          console.log('🗑️ Removing player from game (timeout)');
          this.state.removePlayer(client.sessionId);
          console.log(`👥 Total players after cleanup: ${this.state.players.size}/8`);
        });
        console.log('✅ Reconnection window opened for player:', client.sessionId);
      } catch (error: any) {
        console.error('❌ Failed to allow reconnection:', error);
        console.error('❌ Error details:', {
          message: error?.message,
          stack: error?.stack,
          name: error?.name
        });
      }

      // Player data stays in this.state.players
      // Colyseus will automatically clean it up after seat reservation time expires
    }

    console.log(`👥 Total players: ${this.state.players.size}/8`);
  }

  onDispose() {
    console.log('Room disposed!');
    // Cleanup logic here
  }

  update(deltaTime: number) {
    // Game loop - runs 20 times per second (deltaTime in milliseconds)

    // Only update timer during active phases (not WAITING or GAME_END) and if not paused
    if ((this.state.phase === 'PREPARATION' || this.state.phase === 'COMBAT') && !this.timerPaused) {
      // Accumulate time passed
      this.elapsedTime += deltaTime;

      // Every 1 second (1000ms), decrement timer
      if (this.elapsedTime >= 1000) {
        this.elapsedTime -= 1000;
        this.state.timer--;

        // Check if timer reached 0
        if (this.state.timer <= 0) {
          this.handlePhaseTransition();
        }
      }
    }
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
    this.elapsedTime = 0; // Reset timer accumulator

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

  // Handle phase transitions when timer reaches 0
  handlePhaseTransition() {
    console.log(`⏰ Timer expired! Current phase: ${this.state.phase}`);

    if (this.state.phase === 'PREPARATION') {
      // Transition from PREPARATION to COMBAT
      this.state.phase = 'COMBAT';
      this.state.timer = 30; // Combat phase duration (placeholder)
      this.elapsedTime = 0;

      console.log('⚔️ Starting COMBAT phase...');
      this.broadcast('phase_changed', {
        phase: 'COMBAT',
        roundNumber: this.state.roundNumber,
        message: 'Combat starting!',
      });

      // TODO: Simulate combat
    } else if (this.state.phase === 'COMBAT') {
      // Transition from COMBAT back to PREPARATION
      this.state.roundNumber++;
      this.state.phase = 'PREPARATION';
      this.state.timer = 30;
      this.elapsedTime = 0;

      console.log(`🔄 Round ${this.state.roundNumber} - PREPARATION phase`);
      this.broadcast('phase_changed', {
        phase: 'PREPARATION',
        roundNumber: this.state.roundNumber,
        message: `Round ${this.state.roundNumber} - Prepare your team!`,
      });

      // Give income and regenerate shops for all players
      this.state.players.forEach((player, sessionId) => {
        // Grant 5 gold income each round
        player.gold += 5;
        console.log(`💰 Player ${player.username} received 5 gold (total: ${player.gold})`);

        // Regenerate shop
        const characterIds = CHARACTERS.map(c => c.id);
        this.state.generateShopForPlayer(sessionId, characterIds);
      });
    }
  }
}
