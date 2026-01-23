import colyseus from 'colyseus';
const { Room } = colyseus;
import type { Client } from 'colyseus';
import { ArraySchema } from '@colyseus/schema';
import { GameState, Character, BoardPosition, Player, Matchup } from '../schema/GameState.js';
import { characterService } from '../services/CharacterService.js';
import { AuthService } from '../services/AuthService.js';
import { gameStateSnapshotService } from '../services/GameStateSnapshotService.js';

export class AutoChessRoom extends Room<GameState> {
  maxClients = 8;
  private elapsedTime: number = 0; // Accumulator for timer countdown
  private timerPaused: boolean = false; // Debug flag to pause timer
  private reconnectionPromises: Map<string, Promise<Client>> = new Map(); // Track reconnection promises by userId
  private recoverySessionMap = new Map<number, string>(); // userId → oldSessionId mapping for recovery
  private isRecoveryMode = false; // Flag to indicate we're in server restart recovery
  private savedMatchupsForRecovery: any[] = []; // Store original matchups during recovery
  private mockCombatInterval: NodeJS.Timeout | null = null; // Store interval to clear it later
  private targetLocks: Map<string, string> = new Map(); // Track which character is targeting which (attackerPos → targetPos)
  private characterNextAttackTime: Map<string, number> = new Map(); // characterKey → next attack timestamp

  onCreate(options: any) {
    console.log('AutoChessRoom created!', options);

    // Enable reconnection - keep seat reserved for 30 minutes (1800 seconds)
    // Matches the snapshot expiry time so players can always reconnect
    this.setSeatReservationTime(1800);

    // Keep room unlocked to allow reconnection fallback (session transfer)
    // Security is handled in onAuth - only existing players can join mid-game
    this.unlock();

    // PHASE 1B: Check if this is a recovery (server restart)
    if (options.recover && options.snapshotData) {
      console.log('🔄 RECOVERY MODE: Restoring game from snapshot...');

      // Enable recovery mode
      this.isRecoveryMode = true;

      // Initialize empty state first
      this.setState(new GameState());

      // Parse snapshot data (handle both string and object formats)
      const snapshotData = typeof options.snapshotData === 'string'
        ? JSON.parse(options.snapshotData)
        : options.snapshotData;

      // Build recovery map: userId → oldSessionId
      if (snapshotData.players && Array.isArray(snapshotData.players)) {
        snapshotData.players.forEach((playerData: any) => {
          if (playerData.userId && playerData.sessionId) {
            this.recoverySessionMap.set(playerData.userId, playerData.sessionId);
            console.log(`📋 Recovery map: userId ${playerData.userId} had session ${playerData.sessionId}`);
          }
        });
      }

      // DON'T clear matchups - keep them with old session IDs
      // They'll be updated progressively as players rejoin
      if (snapshotData.currentMatchups && snapshotData.currentMatchups.length > 0) {
        console.log(`💾 Keeping ${snapshotData.currentMatchups.length} matchup(s) with old session IDs for immediate restoration`);
        console.log(`   Matchups will be updated as players rejoin`);
      }
      // DO NOT clear snapshotData.currentMatchups!

      // Restore state from snapshot (without session IDs in matchups)
      this.deserializeGameState(snapshotData);

      console.log(`✅ Room recovered! Players: ${this.state.players.size}, Phase: ${this.state.phase}`);
      console.log(`⏳ Waiting for ${this.recoverySessionMap.size} players to rejoin...`);
    } else {
      // Normal initialization - fresh game
      console.log('🆕 NEW GAME: Creating fresh game state...');
      this.setState(new GameState());
    }

    // Start periodic snapshots to database
    gameStateSnapshotService.startSnapshots(this.roomId, () => this.state);

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

      // Block eliminated players
      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
        return;
      }

      // Check if bench is full
      if (player.bench.length >= 10) {
        console.log(`⚠️ Player ${player.username} bench is full`);
        client.send('error', { message: 'Bench is full' });
        return;
      }

      // Find the character data
      const characterData = characterService.getCharacterById(characterId);
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
      character.emoji = characterData.emoji;
      character.cost = characterData.cost;
      character.rarity = characterData.rarity;
      character.attack = characterData.attack;
      character.defense = characterData.defense;
      character.hp = characterData.hp;
      character.currentHP = characterData.hp; // Initialize current HP
      character.stars = 1;

      // Add to player's bench
      player.bench.push(character);

      console.log(`✅ Player ${player.username} bought ${character.name} for ${characterData.cost} gold. Remaining gold: ${player.gold}, Bench: ${player.bench.length}/10`);
    });

    this.onMessage('move_character', (client, message) => {
      console.log('Player wants to move character:', message);
      // TODO: Implement move character logic
    });

    // Buy XP handler: costs 4 gold, gives 4 XP
    this.onMessage('buy_xp', (client) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      // Block eliminated players
      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
        return;
      }

      const XP_COST = 4;
      const XP_GAIN = 4;

      // Check if player has enough gold
      if (player.gold < XP_COST) {
        console.log(`⚠️ Player ${player.username} cannot afford XP (has ${player.gold} gold, needs ${XP_COST})`);
        return;
      }

      // Deduct gold and add XP
      player.gold -= XP_COST;
      player.xp += XP_GAIN;

      console.log(`💎 Player ${player.username} bought ${XP_GAIN} XP for ${XP_COST} gold (XP: ${player.xp}, Gold: ${player.gold})`);

      // Check for level up
      this.checkAndHandleLevelUp(player);
    });

    // Reroll shop handler: costs 2 gold, regenerates shop
    this.onMessage('reroll_shop', (client) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      // Block eliminated players
      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
        return;
      }

      const REROLL_COST = 2;

      // Check if player has enough gold
      if (player.gold < REROLL_COST) {
        console.log(`⚠️ Player ${player.username} cannot afford reroll (has ${player.gold} gold, needs ${REROLL_COST})`);
        return;
      }

      // Deduct gold
      player.gold -= REROLL_COST;

      // Regenerate shop
      const characterIds = characterService.getAllCharacterIds();
      this.state.generateShopForPlayer(client.sessionId, characterIds);

      console.log(`🔄 Player ${player.username} rerolled shop for ${REROLL_COST} gold (Gold: ${player.gold})`);
    });

    this.onMessage('ready', (client) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      // Toggle ready status
      player.isReady = !player.isReady;

      // Reset acknowledgement if un-readying
      if (!player.isReady) {
        player.hasAcknowledgedRules = false;
      }

      console.log(`${player.isReady ? '✅' : '⏸️'} Player ${player.username} is ${player.isReady ? 'ready' : 'not ready'}`);

      // Send game rules to this player when they click ready
      if (player.isReady) {
        client.send('game_rules', {
          rules: [
            '🛒 Buy characters from the shop using gold',
            '📦 Drag characters from bench to arena',
            '⭐ Unit limit on arena = your level',
            '⚔️ Combat is automatic - units fight on their own',
            '💔 Damage to player = surviving enemy units × round number',
            '🏆 Last player standing wins!',
            '💰 Earn 5 gold + 1 gold per win each round',
            '📈 Gain 2 XP per round, level up for more unit slots',
            '🔄 Reroll shop for 2 gold, buy XP for 4 gold'
          ]
        });
        console.log(`📜 Sent game rules to ${player.username}`);
      }

      // Don't check for game start here - wait for acknowledge_rules
    });

    // Player acknowledges they've read the rules
    this.onMessage('acknowledge_rules', (client) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      player.hasAcknowledgedRules = true;
      console.log(`📖 Player ${player.username} acknowledged game rules`);

      // Check if all players are ready AND have acknowledged rules
      const allReadyAndAcknowledged = this.checkAllPlayersReadyAndAcknowledged();

      if (allReadyAndAcknowledged && this.state.players.size >= 1) { // Minimum 1 player for testing
        console.log('🎮 All players ready and acknowledged rules! Starting game...');
        this.startGame();
      }
    });

    // Handle cancel game - any player can cancel, affects all players
    this.onMessage('cancel_game', (client) => {
      const player = this.state.players.get(client.sessionId);
      console.log(`🚫 Game cancelled by ${player?.username || client.sessionId}`);

      // Broadcast to all clients that game was cancelled
      this.broadcast('game_cancelled', {
        cancelledBy: player?.username || 'Unknown',
      });

      // Disconnect all players after short delay (allows clients to receive message)
      setTimeout(() => {
        this.disconnect();
      }, 500);
    });

    // Sell character from bench - refunds gold
    this.onMessage('sell_character', (client, message: { benchIndex: number }) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      // Block eliminated players
      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
        return;
      }

      // Allow selling during both PREPARATION and COMBAT phases
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

      // Block eliminated players
      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
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
      const characterIds = characterService.getAllCharacterIds();
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

      // Block eliminated players
      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
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

      // Check unit limit (max units on board = player level)
      if (player.board.length >= player.level) {
        console.log(`⚠️ Player ${player.username} at unit limit (${player.board.length}/${player.level})`);
        client.send('error', { message: `Unit limit reached! Level ${player.level} = max ${player.level} units` });
        return;
      }

      // Add character to board
      const boardPos = new BoardPosition();
      boardPos.row = row;
      boardPos.col = col;
      boardPos.character = character;

      // Initialize currentHP to max HP
      character.currentHP = character.hp;

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

      // Block eliminated players
      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
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

      // Block eliminated players
      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
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

      // Block eliminated players
      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
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

    // Swap two arena characters
    this.onMessage('swap_arena', (client, message: { fromRow: number, fromCol: number, toRow: number, toCol: number }) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
        return;
      }

      if (this.state.phase !== 'PREPARATION') {
        client.send('error', { message: 'Can only swap during preparation phase' });
        return;
      }

      const { fromRow, fromCol, toRow, toCol } = message;

      // Find both characters
      const sourcePos = player.board.find(pos => pos.row === fromRow && pos.col === fromCol);
      const targetPos = player.board.find(pos => pos.row === toRow && pos.col === toCol);

      if (!sourcePos?.character || !targetPos?.character) {
        console.log(`⚠️ Missing character for swap`);
        return;
      }

      // Swap positions
      const tempRow = sourcePos.row;
      const tempCol = sourcePos.col;
      sourcePos.row = targetPos.row;
      sourcePos.col = targetPos.col;
      targetPos.row = tempRow;
      targetPos.col = tempCol;

      console.log(`✅ Player ${player.username} swapped ${sourcePos.character.name} ↔️ ${targetPos.character.name}`);
    });

    // Swap bench character with arena character
    this.onMessage('swap_bench_arena', (client, message: { benchIndex: number, row: number, col: number }) => {
      const player = this.state.players.get(client.sessionId);

      if (!player) {
        console.error(`❌ Player ${client.sessionId} not found`);
        return;
      }

      if (player.isEliminated) {
        client.send('error', { message: 'You have been eliminated' });
        return;
      }

      if (this.state.phase !== 'PREPARATION') {
        client.send('error', { message: 'Can only swap during preparation phase' });
        return;
      }

      const { benchIndex, row, col } = message;

      // Validate bench index
      if (benchIndex < 0 || benchIndex >= player.bench.length) {
        console.log(`⚠️ Invalid bench index: ${benchIndex}`);
        return;
      }

      const benchChar = player.bench[benchIndex];
      if (!benchChar) {
        console.log(`⚠️ No character at bench index ${benchIndex}`);
        return;
      }

      // Find arena character
      const arenaPosIndex = player.board.findIndex(pos => pos.row === row && pos.col === col);
      if (arenaPosIndex === -1) {
        console.log(`⚠️ No character at arena position (${row}, ${col})`);
        return;
      }

      const arenaPos = player.board[arenaPosIndex];
      if (!arenaPos.character) {
        console.log(`⚠️ No character at arena position (${row}, ${col})`);
        return;
      }

      // Swap: arena char goes to bench, bench char goes to arena
      const arenaChar = arenaPos.character;

      // Put bench char on arena
      arenaPos.character = benchChar;
      arenaPos.character.currentHP = arenaPos.character.hp; // Reset HP

      // Put arena char on bench
      player.bench[benchIndex] = arenaChar;

      console.log(`✅ Player ${player.username} swapped bench[${benchIndex}] ${benchChar.name} ↔️ arena(${row},${col}) ${arenaChar.name}`);
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

        // Clear all character targets from previous combat
        this.state.players.forEach((player) => {
          player.board.forEach((pos) => {
            if (pos.character) {
              pos.character.targetRow = -1;
              pos.character.targetCol = -1;
              // Force Colyseus to detect nested property change
              pos.setDirty('character');
            }
          });
        });

        // Give income and regenerate shops for all players
        this.state.players.forEach((player) => {
          player.gold += 5;
          console.log(`💰 Player ${player.username} received 5 gold (total: ${player.gold})`);
        });

        const characterIds = characterService.getAllCharacterIds();
        this.state.regenerateAllShops(characterIds);
      }
      console.log(`🔧 DEBUG: Phase toggled to ${this.state.phase} by ${client.sessionId}`);
      // Note: Phase change will be automatically synced via Colyseus onStateChange
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
      });

      // Regenerate shops for all players
      const characterIds = characterService.getAllCharacterIds();
      this.state.regenerateAllShops(characterIds);

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
  /**
   * PHASE 1A: Deserialize JSON snapshot back to Colyseus Schema
   * Converts saved game state from database into GameState schema
   */
  private deserializeGameState(snapshotData: any): void {
    console.log('🔄 Deserializing game state from snapshot...');

    try {
      const data = typeof snapshotData === 'string' ? JSON.parse(snapshotData) : snapshotData;

      // Restore basic game state
      this.state.phase = data.phase || 'WAITING';
      this.state.roundNumber = data.roundNumber || 0;
      this.state.timer = data.timer || 30;

      console.log(`   Phase: ${this.state.phase}, Round: ${this.state.roundNumber}`);

      // Restore players
      if (data.players && Array.isArray(data.players)) {
        for (const playerData of data.players) {
          const player = new Player();

          // Basic player info
          player.id = playerData.id || playerData.sessionId;
          player.username = playerData.username;
          player.userId = playerData.userId;
          player.hp = playerData.hp;
          player.gold = playerData.gold;
          player.xp = playerData.xp;
          player.level = playerData.level;
          player.isReady = playerData.isReady;
          player.isEliminated = playerData.isEliminated;

          // Restore bench characters
          if (playerData.bench && Array.isArray(playerData.bench)) {
            for (const charData of playerData.bench) {
              const character = new Character();
              character.id = charData.id;
              character.name = charData.name;
              character.emoji = charData.emoji;
              character.cost = charData.cost;
              character.rarity = charData.rarity;
              character.attack = charData.attack;
              character.defense = charData.defense;
              character.hp = charData.hp;
              character.currentHP = charData.currentHP ?? charData.hp; // Restore currentHP or use max HP
              character.speed = charData.speed;
              character.stars = charData.stars;
              player.bench.push(character);
            }
          }

          // Restore shop character IDs
          if (playerData.shopCharacterIds && Array.isArray(playerData.shopCharacterIds)) {
            for (const charId of playerData.shopCharacterIds) {
              player.shopCharacterIds.push(charId);
            }
          }

          // Restore board positions
          if (playerData.board && Array.isArray(playerData.board)) {
            for (const posData of playerData.board) {
              const position = new BoardPosition();
              position.row = posData.row;
              position.col = posData.col;

              if (posData.character) {
                const character = new Character();
                character.id = posData.character.id;
                character.name = posData.character.name;
                character.emoji = posData.character.emoji;
                character.cost = posData.character.cost;
                character.rarity = posData.character.rarity;
                character.attack = posData.character.attack;
                character.defense = posData.character.defense;
                character.hp = posData.character.hp;
                character.currentHP = posData.character.currentHP ?? posData.character.hp; // Restore currentHP or use max HP
                character.speed = posData.character.speed;
                character.stars = posData.character.stars;
                position.character = character;
              }

              player.board.push(position);
            }
          }

          // Add player to state
          this.state.players.set(player.id, player);
          console.log(`   ✅ Restored player: ${player.username} (HP: ${player.hp}, Gold: ${player.gold})`);
        }
      }

      // Restore matchups
      if (data.currentMatchups && Array.isArray(data.currentMatchups)) {
        for (const matchupData of data.currentMatchups) {
          const matchup = new Matchup();
          matchup.player1Id = matchupData.player1Id;
          matchup.player2Id = matchupData.player2Id;
          matchup.player1Name = matchupData.player1Name;
          matchup.player2Name = matchupData.player2Name;
          this.state.currentMatchups.push(matchup);
        }
        console.log(`   ✅ Restored ${this.state.currentMatchups.length} matchups`);
      }

      console.log('✅ Game state deserialized successfully!');
    } catch (error) {
      console.error('❌ Failed to deserialize game state:', error);
      throw error;
    }
  }

  async onAuth(client: Client, options: any) {
    const token = options.token;

    // DEBUG Step 2.2: Log what we received
    console.log('🔐 DEBUG Step 2.2: onAuth called with options:', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      optionsKeys: Object.keys(options || {}),
      clientSessionId: client.sessionId
    });

    // Require authentication - no guest access allowed
    if (!token) {
      console.error(`🚫 Player ${client.sessionId} attempted to join without authentication - REJECTED`);
      throw new Error('Authentication required. Please log in to play.');
    }

    try {
      // Verify JWT token
      const decoded = AuthService.verifyAccessToken(token);

      console.log(`✅ Authenticated user: ${decoded.username} (ID: ${decoded.userId})`);

      // Security check: If game already started, only allow returning players
      if (this.state && this.state.phase !== 'WAITING') {
        const isReturningPlayer = Array.from(this.state.players.values())
          .some(p => p.userId === decoded.userId);

        if (!isReturningPlayer) {
          console.error(`🚫 New player ${decoded.username} attempted to join game in progress (Round ${this.state.roundNumber}, ${this.state.phase} phase) - REJECTED`);
          throw new Error('Game already in progress - only returning players can rejoin');
        }

        console.log(`✅ Returning player ${decoded.username} allowed to rejoin (game in progress)`);
      }

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

    // RECOVERY MODE: Check if this userId is rejoining after server restart
    if (this.isRecoveryMode && this.recoverySessionMap.has(auth.userId)) {
      const oldSessionId = this.recoverySessionMap.get(auth.userId)!;
      console.log(`🔄 RECOVERY: User ${auth.displayName} (ID: ${auth.userId}) rejoining after server restart`);
      console.log(`   Old session: ${oldSessionId} → New session: ${client.sessionId}`);

      // Find player by userId (not by sessionId, since sessionId changed)
      let recoveredPlayer: any = null;
      this.state.players.forEach((player, sessionId) => {
        if (player.userId === auth.userId) {
          recoveredPlayer = player;
        }
      });

      if (recoveredPlayer) {
        // Remove old player entry
        this.state.players.forEach((player, sessionId) => {
          if (player.userId === auth.userId) {
            this.state.players.delete(sessionId);
          }
        });

        // Update player's sessionId to new one
        recoveredPlayer.id = client.sessionId;

        // Re-add player with NEW sessionId
        this.state.players.set(client.sessionId, recoveredPlayer);

        // Update matchup references
        this.updateMatchupSessionIds(oldSessionId, client.sessionId);

        console.log(`✅ Restored player ${auth.displayName} with new session ${client.sessionId}`);
        console.log(`   Preserved: HP=${recoveredPlayer.hp}, Gold=${recoveredPlayer.gold}, XP=${recoveredPlayer.xp}, Bench=${recoveredPlayer.bench.length}, Board=${recoveredPlayer.board.length}`);

        // Send matchups if in combat
        if (this.state.phase === 'COMBAT' && this.state.currentMatchups.length > 0) {
          const matchups = this.state.currentMatchups.map((m) => ({
            player1Id: m.player1Id,
            player1Name: m.player1Name,
            player2Id: m.player2Id,
            player2Name: m.player2Name,
          }));

          client.send('combat_matchups', {
            roundNumber: this.state.roundNumber,
            matchups: matchups,
          });

          console.log('   📤 Sent combat matchups to recovered player');
        }

        // Remove from recovery map
        this.recoverySessionMap.delete(auth.userId);

        // If all players have rejoined, exit recovery mode and restore matchups
        if (this.recoverySessionMap.size === 0) {
          this.isRecoveryMode = false;
          console.log('✅ All players have rejoined after server restart, exiting recovery mode');

          // Restore matchups with updated session IDs
          if (this.savedMatchupsForRecovery.length > 0) {
            console.log(`🔄 Restoring ${this.savedMatchupsForRecovery.length} matchup(s) with new session IDs...`);

            this.savedMatchupsForRecovery.forEach((savedMatchup: any) => {
              // Find new session IDs by matching usernames
              const player1 = Array.from(this.state.players.values()).find(p => p.username === savedMatchup.player1Name);
              const player2 = Array.from(this.state.players.values()).find(p => p.username === savedMatchup.player2Name);

              if (player1 && player2) {
                const matchup = new Matchup();
                matchup.player1Id = player1.id;
                matchup.player1Name = player1.username;
                matchup.player2Id = player2.id;
                matchup.player2Name = player2.username;

                this.state.currentMatchups.push(matchup);
                console.log(`   ✅ Restored matchup: ${player1.username} (${player1.id}) vs ${player2.username} (${player2.id})`);
              }
            });

            // Broadcast matchups to all clients
            const matchups = this.state.currentMatchups.map((m) => ({
              player1Id: m.player1Id,
              player1Name: m.player1Name,
              player2Id: m.player2Id,
              player2Name: m.player2Name,
            }));

            this.broadcast('combat_matchups', {
              matchups: matchups,
              roundNumber: this.state.roundNumber,
            });

            console.log(`   📤 Broadcasted restored matchups to all ${this.clients.length} clients`);
          }
        }

        return;
      }
    }

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

      // If reconnecting during COMBAT phase, send matchup info
      if (this.state.phase === 'COMBAT' && this.state.currentMatchups.length > 0) {
        const matchups = this.state.currentMatchups.map((m) => ({
          player1Id: m.player1Id,
          player1Name: m.player1Name,
          player2Id: m.player2Id,
          player2Name: m.player2Name,
        }));

        client.send('combat_matchups', {
          roundNumber: this.state.roundNumber,
          matchups: matchups,
        });

        console.log('   📤 Sent combat matchup to reconnected player (same session)');
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
        // This is the same user trying to reconnect with a new sessionId (token expired or server restart)
        // TRANSFER the old player data to the new sessionId instead of removing it
        console.log(`🔄 User ${auth.displayName} (ID: ${auth.userId}) reconnection token expired, transferring session ${duplicatePlayer.id} → ${client.sessionId}`);

        const oldSessionId = duplicatePlayer.id;

        // Remove player from old sessionId
        this.state.players.delete(oldSessionId);

        // Update player's sessionId to the new one
        duplicatePlayer.id = client.sessionId;

        // Add player back with new sessionId
        this.state.players.set(client.sessionId, duplicatePlayer);

        // Update matchups to use new session ID
        this.state.currentMatchups.forEach((matchup) => {
          if (matchup.player1Id === oldSessionId) {
            matchup.player1Id = client.sessionId;
            console.log(`   Updated matchup player1Id: ${oldSessionId} → ${client.sessionId}`);
          }
          if (matchup.player2Id === oldSessionId) {
            matchup.player2Id = client.sessionId;
            console.log(`   Updated matchup player2Id: ${oldSessionId} → ${client.sessionId}`);
          }
        });

        console.log(`✅ Player data transferred! Preserved: HP=${duplicatePlayer.hp}, Gold=${duplicatePlayer.gold}, XP=${duplicatePlayer.xp}, Bench=${duplicatePlayer.bench.length}, Board=${duplicatePlayer.board.length}`);

        // If we're in COMBAT phase with existing matchups, send updated matchups
        // This is necessary because other players' myOpponentId now points to the old session ID
        if (this.state.phase === 'COMBAT' && this.state.currentMatchups.length > 0) {
          const matchups = this.state.currentMatchups.map((m) => ({
            player1Id: m.player1Id,
            player1Name: m.player1Name,
            player2Id: m.player2Id,
            player2Name: m.player2Name,
          }));

          const matchupData = {
            roundNumber: this.state.roundNumber,
            matchups: matchups,
          };

          // Send to the reconnecting player (may not receive broadcast in time)
          client.send('combat_matchups', matchupData);

          // Broadcast to OTHER clients (exclude current) to update their opponent IDs
          this.broadcast('combat_matchups', matchupData, { except: client });

          console.log(`   📤 Sent matchups to reconnected player + broadcast to others`);
        }

        // Player data is preserved, nothing more to do!
        // Ensure room stays unlocked for future reconnections
        this.unlock();
        return;
      }
    }

    // NEW PLAYER - create new player data
    console.log('🆕 New player joining:', client.sessionId);

    // Add player to game state with authenticated user data
    this.state.addPlayer(client.sessionId, auth.displayName, auth.userId);

    // Generate initial shop for the player
    const characterIds = characterService.getAllCharacterIds();
    this.state.generateShopForPlayer(client.sessionId, characterIds);

    console.log(`👥 Total players: ${this.state.players.size}/8`);

    // Ensure room stays unlocked for future reconnections
    this.unlock();
  }

  async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    const playerName = player?.username || client.sessionId;

    console.log(`👋 ${playerName} left! (consented: ${consented})`);

    if (!player) {
      console.log('⚠️ Player not found in state');
      return;
    }

    // If consented = true, player clicked "Logout" (intentional)
    // If consented = false, it was accidental (browser close, network error)

    // Mark player as disconnected
    player.isConnected = false;

    if (consented) {
      // Intentional disconnect - mark as eliminated and disconnected (keep in leaderboard)
      console.log(`🚪 ${playerName} left intentionally, marking as disconnected`);
      player.isEliminated = true;
      console.log(`👥 Total players: ${this.state.players.size}/8 (${playerName} disconnected)`);
    } else {
      // Accidental disconnect - keep player data for reconnection
      console.log(`⏳ ${playerName} disconnected accidentally, keeping data for reconnection`);

      // Check if this user already has a pending reconnection (rapid disconnect/reconnect)
      const existingPromise = this.reconnectionPromises.get(String(player.userId));
      if (existingPromise) {
        console.log(`⚠️ ${playerName} already has a pending reconnection, skipping duplicate reservation`);
        return;
      }

      // Allow reconnection for this client (async pattern recommended by Colyseus)
      this.handleReconnection(client, player, playerName);

      // Player data stays in this.state.players
      // Colyseus will automatically clean it up after seat reservation time expires
    }

    console.log(`👥 Total players: ${this.state.players.size}/8`);
  }

  async onDispose() {
    console.log('Room disposed!');

    // Clear mock combat interval if running
    if (this.mockCombatInterval) {
      clearInterval(this.mockCombatInterval);
      this.mockCombatInterval = null;
      console.log('🛑 MOCK COMBAT: Interval cleared on dispose');
    }

    // Stop periodic snapshots
    gameStateSnapshotService.stopSnapshots(this.roomId);

    // Delete game session from database (no need to keep completed games)
    await gameStateSnapshotService.finalizeSession(this.roomId);
  }

  /**
   * Update all matchup references from old sessionId to new sessionId
   * Used during recovery when players rejoin with new sessions
   */
  private updateMatchupSessionIds(oldSessionId: string, newSessionId: string): void {
    let updated = 0;

    this.state.currentMatchups.forEach((matchup) => {
      if (matchup.player1Id === oldSessionId) {
        matchup.player1Id = newSessionId;
        updated++;
        console.log(`   Updated matchup player1Id: ${oldSessionId} → ${newSessionId}`);
      }

      if (matchup.player2Id === oldSessionId) {
        matchup.player2Id = newSessionId;
        updated++;
        console.log(`   Updated matchup player2Id: ${oldSessionId} → ${newSessionId}`);
      }
    });

    if (updated > 0) {
      // Broadcast updated matchups to all clients
      const matchups = this.state.currentMatchups.map((m) => ({
        player1Id: m.player1Id,
        player1Name: this.state.players.get(m.player1Id)?.username || 'Unknown',
        player2Id: m.player2Id,
        player2Name: this.state.players.get(m.player2Id)?.username || 'Unknown',
      }));

      this.broadcast('combat_matchups', {
        matchups: matchups,
        roundNumber: this.state.roundNumber,
      });

      console.log(`   📤 Broadcasted updated matchups to all clients`);
    }
  }

  // Helper method for handling reconnection with proper async/await pattern
  private async handleReconnection(client: Client, player: Player, playerName: string) {
    try {
      console.log(`✅ Reconnection window opened for ${playerName} (30 minutes)`);

      // Track the reconnection promise by userId to prevent duplicate reservations
      const reconnectionPromise = this.allowReconnection(client, 1800);
      this.reconnectionPromises.set(String(player.userId), reconnectionPromise);

      // Await the reconnection (recommended Colyseus pattern)
      await reconnectionPromise;

      // Client reconnected successfully
      console.log(`✅ ${playerName} successfully reconnected`);
      this.reconnectionPromises.delete(String(player.userId));

      // Mark player as connected again
      player.isConnected = true;

      // Send combat matchups if in COMBAT phase
      if (this.state.phase === 'COMBAT' && this.state.currentMatchups.length > 0) {
        const matchups = this.state.currentMatchups.map((m) => ({
          player1Id: m.player1Id,
          player1Name: m.player1Name,
          player2Id: m.player2Id,
          player2Name: m.player2Name,
        }));

        client.send('combat_matchups', {
          roundNumber: this.state.roundNumber,
          matchups: matchups,
        });

        console.log(`   📤 Sent combat matchups to reconnected player ${playerName}`);
      }

    } catch (error) {
      // Reconnection window expired or failed - remove player from game
      console.log(`⏰ Reconnection window expired for ${playerName}`);
      console.log('🗑️ Removing player from game (timeout)');
      this.state.removePlayer(client.sessionId);
      this.reconnectionPromises.delete(String(player.userId));
      console.log(`👥 Total players after cleanup: ${this.state.players.size}/8`);
    }
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

  // Check if all players are ready AND have acknowledged the rules
  checkAllPlayersReadyAndAcknowledged(): boolean {
    if (this.state.players.size === 0) return false;

    let allReadyAndAcknowledged = true;
    this.state.players.forEach((player) => {
      if (!player.isReady || !player.hasAcknowledgedRules) {
        allReadyAndAcknowledged = false;
      }
    });

    return allReadyAndAcknowledged;
  }

  // Start the game when all players are ready
  startGame() {
    console.log('🚀 Game starting!');

    // Keep room unlocked for reconnections (may be locked by Colyseus after onCreate)
    this.unlock();

    // Change phase to PREPARATION
    this.state.phase = 'PREPARATION';
    this.state.roundNumber = 1;
    this.state.timer = 30;
    this.elapsedTime = 0; // Reset timer accumulator

    // Reset all players' ready status
    this.state.players.forEach((player) => {
      player.isReady = false;
    });

    // Note: Game start is communicated via automatic state sync (phase change)

    console.log('✅ Game started successfully!');
  }

  /**
   * Auto-fill each player's arena with bench characters up to their level
   * Called before transitioning to COMBAT phase
   */
  autoFillArenasBeforeCombat() {
    this.state.players.forEach((player) => {
      // Skip eliminated players
      if (player.isEliminated) return;

      const currentBoardCount = player.board.length;
      const maxUnits = player.level;
      const spotsToFill = maxUnits - currentBoardCount;

      if (spotsToFill <= 0 || player.bench.length === 0) {
        return; // Arena is already full or bench is empty
      }

      console.log(`🔄 Auto-filling arena for ${player.username}: ${currentBoardCount}/${maxUnits} units, ${spotsToFill} spots available`);

      let filled = 0;
      // Collect indices to remove (in reverse order to avoid index shifting issues)
      const indicesToRemove: number[] = [];

      // Try to place bench characters on the arena
      for (let benchIndex = 0; benchIndex < player.bench.length && filled < spotsToFill; benchIndex++) {
        const character = player.bench[benchIndex];
        if (!character) continue;

        // Find an empty position in player's side (columns 5-8)
        const emptyPosition = this.findEmptyPositionOnPlayerSide(player);
        if (emptyPosition) {
          // Create a new board position with the character
          const boardPos = new BoardPosition();
          boardPos.row = emptyPosition.row;
          boardPos.col = emptyPosition.col;
          boardPos.character = character;

          // Add to board
          player.board.push(boardPos);

          // Mark for removal
          indicesToRemove.push(benchIndex);

          filled++;
          console.log(`✅ Auto-placed ${character.name} at (${emptyPosition.row}, ${emptyPosition.col}) for ${player.username}`);
        }
      }

      // Remove from bench in reverse order to maintain correct indices
      for (let i = indicesToRemove.length - 1; i >= 0; i--) {
        player.bench.splice(indicesToRemove[i], 1);
      }

      if (filled > 0) {
        console.log(`✅ Auto-filled ${filled} characters for ${player.username}. Board now: ${player.board.length}/${maxUnits}`);
      }
    });
  }

  /**
   * Check if player has enough XP to level up and handle the level-up
   */
  checkAndHandleLevelUp(player: Player) {
    // Level-up XP requirements (cumulative)
    const LEVEL_UP_XP: { [key: number]: number } = {
      1: 0,
      2: 2,
      3: 4,
      4: 12,
      5: 24,
      6: 44,
      7: 79,
      8: 119,
      9: 179,
      10: 249,
    };

    const MAX_LEVEL = 10;
    const currentLevel = player.level;

    // Check if player can level up
    if (currentLevel < MAX_LEVEL) {
      const nextLevel = currentLevel + 1;
      const xpRequired = LEVEL_UP_XP[nextLevel];

      if (player.xp >= xpRequired) {
        player.level = nextLevel;
        console.log(`🎉 Player ${player.username} leveled up to ${nextLevel}!`);

        // Send level-up notification to client
        const playerClient = Array.from(this.clients).find(
          (client) => client.sessionId === player.id
        );

        if (playerClient) {
          playerClient.send('level_up', {
            newLevel: nextLevel,
            message: `You can now field ${nextLevel} units!`,
          });
        }
      }
    }
  }

  /**
   * Find an empty position on the player's side of the arena (columns 5-8)
   * Returns the first available position or null if arena is full
   */
  findEmptyPositionOnPlayerSide(player: Player): { row: number; col: number } | null {
    // Check all positions in player's side (columns 5-8, rows 0-7)
    for (let col = 5; col <= 8; col++) {
      for (let row = 0; row <= 7; row++) {
        // Check if this position is already occupied
        const occupied = player.board.some(
          (pos) => pos.row === row && pos.col === col
        );
        if (!occupied) {
          return { row, col };
        }
      }
    }
    return null; // No empty positions found
  }

  // Handle phase transitions when timer reaches 0
  handlePhaseTransition() {
    console.log(`⏰ Timer expired! Current phase: ${this.state.phase}`);

    if (this.state.phase === 'PREPARATION') {
      // Auto-fill arena with bench characters up to player level
      this.autoFillArenasBeforeCombat();

      // Transition from PREPARATION to COMBAT
      this.state.phase = 'COMBAT';
      this.state.timer = 30; // Combat phase duration (placeholder)
      this.elapsedTime = 0;

      console.log('⚔️ Starting COMBAT phase...');

      // Generate matchups for this round
      this.state.generateMatchups(this.state.roundNumber);

      // Build matchup data for broadcast with player names
      const matchupsData = this.state.currentMatchups.map(matchup => ({
        player1Id: matchup.player1Id,
        player2Id: matchup.player2Id,
        player1Name: matchup.player1Name,
        player2Name: matchup.player2Name,
      }));

      // Broadcast matchups to all clients
      this.broadcast('combat_matchups', {
        matchups: matchupsData,
        roundNumber: this.state.roundNumber,
      });

      // Send rest message to bye player (odd number of players)
      if (this.state.byePlayerId) {
        const byeClient = Array.from(this.clients).find(c => c.sessionId === this.state.byePlayerId);
        const byePlayer = this.state.players.get(this.state.byePlayerId);

        if (byeClient && byePlayer) {
          byeClient.send('rest_round', {
            message: 'Rest Round',
          });
          console.log(`💤 Sent rest message to ${byePlayer.username}`);
        }
      }

      // Note: Phase change will be automatically synced via Colyseus onStateChange

      const COMBAT_DEBUG = false; // Toggle: true = detailed logs, false = summary only

      // Helper function: Calculate distance between two positions (Manhattan distance)
      const getDistance = (pos1: {row: number, col: number}, pos2: {row: number, col: number}): number => {
        return Math.abs(pos1.row - pos2.row) + Math.abs(pos1.col - pos2.col);
      };

      // Helper function: Calculate attack cooldown based on character speed
      const getAttackCooldown = (speed: number): number => {
        return 10000 / (speed / 10); // Speed 10 = 1000ms (1 attack/sec), Speed 20 = 500ms (2 attacks/sec)
      };

      // Combat statistics tracking
      const combatStats = {
        totalAttacks: 0,
        totalDamage: 0,
        team1Attacks: 0,
        team2Attacks: 0,
        team1Damage: 0,
        team2Damage: 0
      };

      // Start speed-based combat system
      console.log('⚔️ COMBAT: Starting speed-based combat');
      this.characterNextAttackTime.clear();

      // Track which matchups have been forfeited (to prevent infinite loop on disconnect)
      const processedForfeits = new Set<string>();
      // Track which matchups have completed (to allow other matchups to continue)
      const completedMatchups = new Set<string>();

      // Combat tick runs every 50ms to check for attacks
      this.mockCombatInterval = setInterval(() => {
        const currentTime = Date.now();
        const matchups = this.state.currentMatchups;
        if (matchups.length === 0) return;

        // Process each matchup
        matchups.forEach((matchup) => {
          const matchupKey = `${matchup.player1Id}-${matchup.player2Id}`;

          // Skip already completed matchups
          if (completedMatchups.has(matchupKey) || processedForfeits.has(matchupKey)) {
            return;
          }

          const player1 = this.state.players.get(matchup.player1Id);
          const player2 = this.state.players.get(matchup.player2Id);

          // Handle disconnected player - award win to connected player
          if (!player1 || !player2) {
            const connectedPlayer = player1 || player2;

            if (connectedPlayer) {
              connectedPlayer.gold += 1;
              console.log(`🏆 ${connectedPlayer.username} wins by forfeit (opponent disconnected) (+1 gold → ${connectedPlayer.gold})`);

              const connectedClient = Array.from(this.clients).find(
                (c) => c.sessionId === (player1 ? matchup.player1Id : matchup.player2Id)
              );
              if (connectedClient) {
                connectedClient.send('combat_victory', {
                  message: 'Opponent disconnected - You win!',
                  goldEarned: 1,
                  opponentName: 'Disconnected Player'
                });
              }
            }

            // Mark as forfeit and check if all matchups done
            processedForfeits.add(matchupKey);
            if (completedMatchups.size + processedForfeits.size >= matchups.length) {
              if (this.mockCombatInterval) {
                clearInterval(this.mockCombatInterval);
                this.mockCombatInterval = null;
                console.log('✅ All matchups complete - combat interval cleared');
              }
            }
            return;
          }

          // Get alive characters from both teams
          const team1Chars: Array<{pos: any, boardPos: {row: number, col: number}}> = [];
          const team2Chars: Array<{pos: any, boardPos: {row: number, col: number}}> = [];

          player1.board.forEach((pos) => {
            if (pos?.character && pos.character.currentHP > 0) {
              team1Chars.push({pos, boardPos: {row: pos.row, col: pos.col}});
            }
          });

          player2.board.forEach((pos) => {
            if (pos?.character && pos.character.currentHP > 0) {
              team2Chars.push({pos, boardPos: {row: pos.row, col: pos.col}});
            }
          });

          // Check elimination BEFORE processing attacks
          if (team1Chars.length === 0 || team2Chars.length === 0) {
            // Combat is over! Determine winner
            const player1Won = team1Chars.length > 0;
            const player2Won = team2Chars.length > 0;
            const winner = player1Won ? player1 : (player2Won ? player2 : null);
            const loser = player1Won ? player2 : (player2Won ? player1 : null);

            // Show combat summary (always visible) - single line
            console.log(`⚔️ Combat Summary: ${combatStats.totalAttacks} attacks, ${combatStats.totalDamage} damage | Team1: ${combatStats.team1Attacks} attacks, ${combatStats.team1Damage} dmg | Team2: ${combatStats.team2Attacks} attacks, ${combatStats.team2Damage} dmg | Result: Team1=${team1Chars.length} vs Team2=${team2Chars.length}`);

            if (winner && loser) {
              // Normal case: One team won
              // Award winner +1 gold
              winner.gold += 1;

              // Calculate damage to loser (based on surviving enemy units * round number)
              const survivingUnits = player1Won ? team1Chars.length : team2Chars.length;
              const damageToPlayer = survivingUnits * this.state.roundNumber;
              loser.hp = Math.max(0, loser.hp - damageToPlayer);

              console.log(`🏆 Winner: ${winner.username} (+1 gold → ${winner.gold}) | 💔 Loser: ${loser.username} (-${damageToPlayer} HP → ${loser.hp})`);

              // Send victory message to winner
              const winnerClient = Array.from(this.clients).find(
                (c) => c.sessionId === (player1Won ? matchup.player1Id : matchup.player2Id)
              );
              if (winnerClient) {
                winnerClient.send('combat_victory', {
                  message: `${winner.username} has won this match!`,
                  goldEarned: 1,
                  opponentName: loser.username
                });
              }

              // Send defeat message to loser
              const loserClient = Array.from(this.clients).find(
                (c) => c.sessionId === (player1Won ? matchup.player2Id : matchup.player1Id)
              );
              if (loserClient) {
                // Check if loser is eliminated (HP reached 0)
                if (loser.hp <= 0 && !loser.isEliminated) {
                  loser.isEliminated = true;
                  loserClient.send('game_over', {
                    message: 'You have been eliminated!',
                    finalHP: 0,
                    roundNumber: this.state.roundNumber
                  });
                  console.log(`💀 ${loser.username} has been eliminated (HP: 0)`);
                } else {
                  loserClient.send('combat_defeat', {
                    message: `You lost to ${winner.username}!`,
                    damageTaken: damageToPlayer,
                    opponentName: winner.username
                  });
                }
              }
            } else if (!winner && !loser) {
              // Draw case: Both teams eliminated simultaneously
              const drawDamage = 2; // Fixed damage for draws
              player1.hp = Math.max(0, player1.hp - drawDamage);
              player2.hp = Math.max(0, player2.hp - drawDamage);

              console.log(`🤝 DRAW: ${player1.username} (HP: ${player1.hp}) and ${player2.username} (HP: ${player2.hp}) both lost ${drawDamage} HP`);

              // Send draw or elimination message to both players
              const player1Client = Array.from(this.clients).find(
                (c) => c.sessionId === matchup.player1Id
              );
              const player2Client = Array.from(this.clients).find(
                (c) => c.sessionId === matchup.player2Id
              );

              if (player1Client) {
                if (player1.hp <= 0 && !player1.isEliminated) {
                  player1.isEliminated = true;
                  player1Client.send('game_over', {
                    message: 'You have been eliminated!',
                    finalHP: 0,
                    roundNumber: this.state.roundNumber
                  });
                  console.log(`💀 ${player1.username} has been eliminated (HP: 0)`);
                } else {
                  player1Client.send('combat_draw', {
                    message: 'You both lose 2 HP',
                    damageTaken: drawDamage,
                    opponentName: player2.username
                  });
                }
              }

              if (player2Client) {
                if (player2.hp <= 0 && !player2.isEliminated) {
                  player2.isEliminated = true;
                  player2Client.send('game_over', {
                    message: 'You have been eliminated!',
                    finalHP: 0,
                    roundNumber: this.state.roundNumber
                  });
                  console.log(`💀 ${player2.username} has been eliminated (HP: 0)`);
                } else {
                  player2Client.send('combat_draw', {
                    message: 'You both lose 2 HP',
                    damageTaken: drawDamage,
                    opponentName: player1.username
                  });
                }
              }
            }

            // Clear targets for all characters (modify in place to preserve Colyseus sync)
            const allChars = [...team1Chars, ...team2Chars];
            allChars.forEach((char) => {
              if (char.pos.character) {
                char.pos.character.targetRow = -1;
                char.pos.character.targetCol = -1;
                // Force Colyseus to detect nested property change
                char.pos.setDirty('character');
              }
            });

            // Mark this matchup as completed
            const matchupKey = `${matchup.player1Id}-${matchup.player2Id}`;
            completedMatchups.add(matchupKey);
            console.log(`✅ Matchup completed (${completedMatchups.size}/${matchups.length})`);

            // Check if ALL matchups are done - only then clear the interval
            if (completedMatchups.size + processedForfeits.size >= matchups.length) {
              if (this.mockCombatInterval) {
                clearInterval(this.mockCombatInterval);
                this.mockCombatInterval = null;
                console.log('✅ All matchups complete - combat interval cleared');
              }
            }

            return; // Exit this matchup processing
          }

          // Process speed-based attacks for each character
          if (team1Chars.length > 0 && team2Chars.length > 0) {
            // Both teams have characters - continue combat
            // Team 1 attacks Team 2 (speed-based)
            team1Chars.forEach((attacker) => {
              const attackerChar = attacker.pos.character;
              const attackerKey = `${matchup.player1Id}_${attacker.boardPos.row}_${attacker.boardPos.col}`;

              // Check if this character is ready to attack based on speed
              const nextAttackTime = this.characterNextAttackTime.get(attackerKey) || 0;
              if (currentTime < nextAttackTime) {
                return; // Not ready to attack yet
              }

              // Calculate attack cooldown based on speed
              const attackCooldown = getAttackCooldown(attackerChar.speed);
              this.characterNextAttackTime.set(attackerKey, currentTime + attackCooldown);

              // Check if this character already has a locked target
              let nearestEnemy = null;
              let minDistance = Infinity;
              const enemiesAtMinDistance: any[] = [];

              const lockedTargetKey = this.targetLocks.get(attackerKey);
              if (lockedTargetKey) {
                // Try to find the locked target (if still alive)
                const lockedTarget = team2Chars.find(enemy =>
                  `${enemy.boardPos.row},${enemy.boardPos.col}` === lockedTargetKey
                );
                if (lockedTarget) {
                  nearestEnemy = lockedTarget;
                  // Mirror enemy position for distance calculation (enemy is on opposite side)
                  const mirroredTargetPos = {row: lockedTarget.boardPos.row, col: 8 - lockedTarget.boardPos.col};
                  minDistance = getDistance(attacker.boardPos, mirroredTargetPos);

                  // Set target in schema (locked target still needs to sync to client!)
                  attackerChar.targetRow = nearestEnemy.boardPos.row;
                  attackerChar.targetCol = nearestEnemy.boardPos.col;
                  // Force Colyseus to detect nested property change
                  attacker.pos.setDirty('character');
                } else {
                  // Locked target died, clear the lock
                  this.targetLocks.delete(attackerKey);
                }
              }

              // If no locked target, find nearest enemy (TEAM1)
              if (!nearestEnemy) {
                team2Chars.forEach((enemy) => {
                  // Mirror enemy position for distance calculation (enemy is on opposite side)
                  const mirroredEnemyPos = {row: enemy.boardPos.row, col: 8 - enemy.boardPos.col};
                  const distance = getDistance(attacker.boardPos, mirroredEnemyPos);
                  // Skip enemies at distance 0 (same position - shouldn't happen but prevents self-targeting)
                  if (distance === 0) return;

                  if (distance < minDistance) {
                    minDistance = distance;
                    nearestEnemy = enemy;
                    enemiesAtMinDistance.length = 0;
                    enemiesAtMinDistance.push(enemy);
                  } else if (distance === minDistance) {
                    enemiesAtMinDistance.push(enemy);
                  }
                });

                if (enemiesAtMinDistance.length > 1) {
                  nearestEnemy = enemiesAtMinDistance[Math.floor(Math.random() * enemiesAtMinDistance.length)];
                }

                // Lock onto this target
                if (nearestEnemy) {
                  const targetKey = `${nearestEnemy.boardPos.row},${nearestEnemy.boardPos.col}`;
                  this.targetLocks.set(attackerKey, targetKey);

                  // Set target in schema (DIRECTLY modify existing object for Colyseus sync)
                  attackerChar.targetRow = nearestEnemy.boardPos.row;
                  attackerChar.targetCol = nearestEnemy.boardPos.col;
                  // Force Colyseus to detect nested property change
                  attacker.pos.setDirty('character');

                  if (COMBAT_DEBUG) {
                    console.log(`🎯 LOCK ${attackerChar.emoji} at [${attacker.boardPos.row},${attacker.boardPos.col}] → target [${attackerChar.targetRow},${attackerChar.targetCol}]`);
                  }
                }
              }

              if (nearestEnemy) {
                // Calculate damage and apply HP decrease
                const targetChar = nearestEnemy.pos.character;
                const damage = Math.max(1, attackerChar.attack - targetChar.defense);
                const oldHP = targetChar.currentHP;

                // Update HP directly on existing Character (preserves Colyseus change tracking)
                targetChar.currentHP = Math.max(0, targetChar.currentHP - damage);

                // Track stats (always)
                combatStats.totalAttacks++;
                combatStats.totalDamage += damage;
                combatStats.team1Attacks++;
                combatStats.team1Damage += damage;

                if (COMBAT_DEBUG) {
                  console.log(`⚔️ ${attackerChar.name} [${attacker.boardPos.row},${attacker.boardPos.col}] → ${targetChar.name} [${nearestEnemy.boardPos.row},${nearestEnemy.boardPos.col}] : (${minDistance}) dealt ${damage} dmg (HP: ${oldHP} → ${targetChar.currentHP})`);
                }
              }
            });

            // Team 2 attacks Team 1 (speed-based)
            team2Chars.forEach((attacker) => {
              const attackerChar = attacker.pos.character;
              const attackerKey = `${matchup.player2Id}_${attacker.boardPos.row}_${attacker.boardPos.col}`;

              // Check if this character is ready to attack based on speed
              const nextAttackTime = this.characterNextAttackTime.get(attackerKey) || 0;
              if (currentTime < nextAttackTime) {
                return; // Not ready to attack yet
              }

              // Calculate attack cooldown based on speed
              const attackCooldown = getAttackCooldown(attackerChar.speed);
              this.characterNextAttackTime.set(attackerKey, currentTime + attackCooldown);

              // Check if this character already has a locked target
              let nearestEnemy = null;
              let minDistance = Infinity;
              const enemiesAtMinDistance: any[] = [];

              const lockedTargetKey = this.targetLocks.get(attackerKey);
              if (lockedTargetKey) {
                // Try to find the locked target (if still alive)
                const lockedTarget = team1Chars.find(enemy =>
                  `${enemy.boardPos.row},${enemy.boardPos.col}` === lockedTargetKey
                );
                if (lockedTarget) {
                  nearestEnemy = lockedTarget;
                  // Mirror enemy position for distance calculation (enemy is on opposite side)
                  const mirroredTargetPos = {row: lockedTarget.boardPos.row, col: 8 - lockedTarget.boardPos.col};
                  minDistance = getDistance(attacker.boardPos, mirroredTargetPos);

                  // Set target in schema (locked target still needs to sync to client!)
                  attackerChar.targetRow = nearestEnemy.boardPos.row;
                  attackerChar.targetCol = nearestEnemy.boardPos.col;
                  // Force Colyseus to detect nested property change
                  attacker.pos.setDirty('character');
                } else {
                  // Locked target died, clear the lock
                  this.targetLocks.delete(attackerKey);
                }
              }

              // If no locked target, find nearest enemy (TEAM2)
              if (!nearestEnemy) {
                team1Chars.forEach((enemy) => {
                  // Mirror enemy position for distance calculation (enemy is on opposite side)
                  const mirroredEnemyPos = {row: enemy.boardPos.row, col: 8 - enemy.boardPos.col};
                  const distance = getDistance(attacker.boardPos, mirroredEnemyPos);
                  // Skip enemies at distance 0 (same position - shouldn't happen but prevents self-targeting)
                  if (distance === 0) return;

                  if (distance < minDistance) {
                    minDistance = distance;
                    nearestEnemy = enemy;
                    enemiesAtMinDistance.length = 0;
                    enemiesAtMinDistance.push(enemy);
                  } else if (distance === minDistance) {
                    enemiesAtMinDistance.push(enemy);
                  }
                });

                if (enemiesAtMinDistance.length > 1) {
                  nearestEnemy = enemiesAtMinDistance[Math.floor(Math.random() * enemiesAtMinDistance.length)];
                }

                // Lock onto this target
                if (nearestEnemy) {
                  const targetKey = `${nearestEnemy.boardPos.row},${nearestEnemy.boardPos.col}`;
                  this.targetLocks.set(attackerKey, targetKey);

                  // Set target in schema (DIRECTLY modify existing object for Colyseus sync)
                  attackerChar.targetRow = nearestEnemy.boardPos.row;
                  attackerChar.targetCol = nearestEnemy.boardPos.col;
                  // Force Colyseus to detect nested property change
                  attacker.pos.setDirty('character');

                  if (COMBAT_DEBUG) {
                    console.log(`🎯 LOCK ${attackerChar.emoji} at [${attacker.boardPos.row},${attacker.boardPos.col}] → target [${attackerChar.targetRow},${attackerChar.targetCol}]`);
                  }
                }
              }

              if (nearestEnemy) {
                // Calculate damage and apply HP decrease
                const targetChar = nearestEnemy.pos.character;
                const damage = Math.max(1, attackerChar.attack - targetChar.defense);
                const oldHP = targetChar.currentHP;

                // Update HP directly on existing Character (preserves Colyseus change tracking)
                targetChar.currentHP = Math.max(0, targetChar.currentHP - damage);

                // Track stats (always)
                combatStats.totalAttacks++;
                combatStats.totalDamage += damage;
                combatStats.team2Attacks++;
                combatStats.team2Damage += damage;

                if (COMBAT_DEBUG) {
                  console.log(`⚔️ ${attackerChar.name} [${attacker.boardPos.row},${attacker.boardPos.col}] → ${targetChar.name} [${nearestEnemy.boardPos.row},${nearestEnemy.boardPos.col}] : (${minDistance}) dealt ${damage} dmg (HP: ${oldHP} → ${targetChar.currentHP})`);
                }
              }
            });
          } else {
            // One team eliminated - clear targets for surviving characters (modify in place to preserve Colyseus sync)
            const allChars = [...team1Chars, ...team2Chars];
            allChars.forEach((char) => {
              if (char.pos.character) {
                char.pos.character.targetRow = -1;
                char.pos.character.targetCol = -1;
                // Force Colyseus to detect nested property change
                char.pos.setDirty('character');
              }
            });
          }
        });
      }, 50); // Check for attacks every 50ms (20 ticks/second)
    } else if (this.state.phase === 'COMBAT') {
      // Transition from COMBAT back to PREPARATION

      // Clear mock combat interval
      if (this.mockCombatInterval) {
        clearInterval(this.mockCombatInterval);
        this.mockCombatInterval = null;
        console.log('🛑 MOCK COMBAT: Interval cleared');
      }

      // Clear target locks and attack timings for next round
      this.targetLocks.clear();
      this.characterNextAttackTime.clear();

      // Reset all characters to full HP (only for alive players)
      this.state.players.forEach((player) => {
        // Skip already eliminated players
        if (player.isEliminated) return;

        let restoredCount = 0;

        player.board.forEach((pos) => {
          if (pos?.character) {
            // Restore HP directly on existing Character (preserves Colyseus sync)
            pos.character.currentHP = pos.character.hp; // Reset to max HP
            pos.character.targetRow = -1; // Clear target from previous combat
            pos.character.targetCol = -1; // Clear target from previous combat
            // Force Colyseus to detect nested property change
            pos.setDirty('character');
            restoredCount++;
          }
        });

        if (restoredCount > 0) {
          console.log(`♻️ ${player.username}: ${restoredCount} characters restored to full HP`);
        }
      });

      // Check for newly eliminated players (HP <= 0) and send game over message
      this.state.players.forEach((player) => {
        // Skip if already marked as eliminated
        if (player.isEliminated) return;

        if (player.hp <= 0) {
          const eliminatedClient = Array.from(this.clients).find(
            (c) => c.sessionId === player.id
          );

          if (eliminatedClient) {
            eliminatedClient.send('game_over', {
              message: 'You have been eliminated!',
              finalHP: 0,
              roundNumber: this.state.roundNumber
            });
          }
          // Mark player as eliminated so they're excluded from future rounds
          player.isEliminated = true;
          console.log(`💀 ${player.username} has been eliminated (HP: 0)`);
        }
      });

      // Check for game winner (only one non-eliminated player remaining)
      const alivePlayers = Array.from(this.state.players.values()).filter(p => p.hp > 0 && !p.isEliminated);
      if (alivePlayers.length === 1) {
        const winner = alivePlayers[0];
        const winnerClient = Array.from(this.clients).find(
          (c) => c.sessionId === winner.id
        );

        if (winnerClient) {
          winnerClient.send('game_winner', {
            message: 'You are the champion!',
            finalHP: winner.hp,
            roundNumber: this.state.roundNumber
          });
        }
        console.log(`👑 ${winner.username} wins the game! (HP: ${winner.hp}, Round: ${this.state.roundNumber})`);

        this.state.phase = 'GAME_END';
        return; // Don't continue to next round
      }

      this.state.roundNumber++;
      this.state.phase = 'PREPARATION';
      this.state.timer = 30;
      this.elapsedTime = 0;

      console.log(`🔄 Round ${this.state.roundNumber} - PREPARATION phase`);
      // Note: Phase change will be automatically synced via Colyseus onStateChange

      // Award XP and handle level-ups, give income and regenerate shops (only for alive players)
      this.state.players.forEach((player) => {
        // Skip eliminated players
        if (player.isEliminated) return;

        // Award 2 XP per round
        const XP_PER_ROUND = 2;
        player.xp += XP_PER_ROUND;
        console.log(`📈 Player ${player.username} received ${XP_PER_ROUND} XP (total: ${player.xp})`);

        // Check for level up
        this.checkAndHandleLevelUp(player);

        // Grant 5 gold income each round
        player.gold += 5;
        console.log(`💰 Player ${player.username} received 5 gold (total: ${player.gold})`);
      });

      // Regenerate shops for all players
      const characterIds = characterService.getAllCharacterIds();
      this.state.regenerateAllShops(characterIds);
    }
  }
}
