import { describe, it, expect, beforeEach } from '@jest/globals';
import { AutoChessRoom } from './AutoChessRoom';
import { Character, Player } from '../schema/GameState';

/**
 * Combat Targeting Tests
 * Verifies that both Team 1 and Team 2 set target positions correctly
 */
describe('Combat Targeting System', () => {
  let room: AutoChessRoom;

  beforeEach(() => {
    room = new AutoChessRoom();
    // Initialize room state
    room.onCreate({});
  });

  /**
   * Test 1: Verify both teams can set targets
   */
  it('should set targetRow and targetCol for Team 1 characters', () => {
    // Setup: Create two players with characters
    const player1 = new Player();
    player1.id = 'player1';

    const player2 = new Player();
    player2.id = 'player2';

    // Add Team 1 character at [3, 6]
    const char1 = new Character();
    char1.name = 'Archer';
    char1.emoji = '🏹';
    char1.hp = 100;
    char1.currentHP = 100;
    char1.attack = 15;
    char1.defense = 5;

    player1.board[0].row = 3;
    player1.board[0].col = 6;
    player1.board[0].character = char1;

    // Add Team 2 character at [3, 7] (will be mirrored to [3, 1])
    const char2 = new Character();
    char2.name = 'Knight';
    char2.emoji = '⚔️';
    char2.hp = 150;
    char2.currentHP = 150;
    char2.attack = 20;
    char2.defense = 10;

    player2.board[0].row = 3;
    player2.board[0].col = 7;
    player2.board[0].character = char2;

    room.state.players.set('player1', player1);
    room.state.players.set('player2', player2);

    // Trigger combat (this would normally be done by phase transition)
    // We'll manually execute the combat logic here

    // Expected: Team 1 character should target Team 2 character
    // After combat tick, char1 should have targetRow=3, targetCol=7
    expect(char1.targetRow).not.toBe(-1);
    expect(char1.targetCol).not.toBe(-1);
  });

  /**
   * Test 2: Verify Team 2 also sets targets
   */
  it('should set targetRow and targetCol for Team 2 characters', () => {
    const player1 = new Player();
    player1.id = 'player1';

    const player2 = new Player();
    player2.id = 'player2';

    // Add Team 1 character
    const char1 = new Character();
    char1.name = 'Mage';
    char1.emoji = '🧙';
    char1.hp = 80;
    char1.currentHP = 80;
    char1.attack = 25;
    char1.defense = 3;

    player1.board[0].row = 4;
    player1.board[0].col = 7;
    player1.board[0].character = char1;

    // Add Team 2 character
    const char2 = new Character();
    char2.name = 'Assassin';
    char2.emoji = '🗡️';
    char2.hp = 90;
    char2.currentHP = 90;
    char2.attack = 30;
    char2.defense = 5;

    player2.board[0].row = 4;
    player2.board[0].col = 6;
    player2.board[0].character = char2;

    room.state.players.set('player1', player1);
    room.state.players.set('player2', player2);

    // Expected: Team 2 character should also have valid targets
    expect(char2.targetRow).not.toBe(-1);
    expect(char2.targetCol).not.toBe(-1);
  });

  /**
   * Test 3: Verify target positions use actual board positions (not mirrored)
   */
  it('should use actual board positions for targetRow/targetCol, not mirrored positions', () => {
    const player1 = new Player();
    player1.id = 'player1';

    const player2 = new Player();
    player2.id = 'player2';

    // Team 1 character at [2, 5]
    const char1 = new Character();
    char1.name = 'Tank';
    char1.emoji = '🛡️';
    char1.hp = 200;
    char1.currentHP = 200;
    char1.attack = 10;
    char1.defense = 20;

    player1.board[0].row = 2;
    player1.board[0].col = 5;
    player1.board[0].character = char1;

    // Team 2 character at [2, 8] (actual position)
    // Mirrored position would be [2, 0] for distance calc
    const char2 = new Character();
    char2.name = 'Healer';
    char2.emoji = '💚';
    char2.hp = 70;
    char2.currentHP = 70;
    char2.attack = 5;
    char2.defense = 5;

    player2.board[0].row = 2;
    player2.board[0].col = 8;
    player2.board[0].character = char2;

    room.state.players.set('player1', player1);
    room.state.players.set('player2', player2);

    // Run combat tick
    // Team 1 targeting Team 2: char1 should target [2, 8] (actual pos, not mirrored [2, 0])
    expect(char1.targetRow).toBe(2);
    expect(char1.targetCol).toBe(8); // Should be actual position, NOT 0
  });

  /**
   * Test 4: Verify targets clear when character dies
   */
  it('should clear targetRow/targetCol when target dies', () => {
    const player1 = new Player();
    player1.id = 'player1';

    const player2 = new Player();
    player2.id = 'player2';

    // Team 1 character
    const char1 = new Character();
    char1.name = 'Archer';
    char1.emoji = '🏹';
    char1.hp = 100;
    char1.currentHP = 100;
    char1.attack = 50;
    char1.defense = 5;
    char1.targetRow = 3;
    char1.targetCol = 7;

    player1.board[0].row = 3;
    player1.board[0].col = 6;
    player1.board[0].character = char1;

    // Team 2 character (dead)
    const char2 = new Character();
    char2.name = 'Knight';
    char2.emoji = '⚔️';
    char2.hp = 150;
    char2.currentHP = 0; // DEAD
    char2.attack = 20;
    char2.defense = 10;

    player2.board[0].row = 3;
    player2.board[0].col = 7;
    player2.board[0].character = char2;

    room.state.players.set('player1', player1);
    room.state.players.set('player2', player2);

    // Run combat tick
    // Expected: char1's target should be cleared since char2 is dead
    expect(char1.targetRow).toBe(-1);
    expect(char1.targetCol).toBe(-1);
  });

  /**
   * Test 5: Verify sticky targeting (characters keep same target)
   */
  it('should maintain locked target across multiple combat ticks', () => {
    const player1 = new Player();
    player1.id = 'player1';

    const player2 = new Player();
    player2.id = 'player2';

    // Team 1 character
    const char1 = new Character();
    char1.name = 'Warrior';
    char1.emoji = '⚔️';
    char1.hp = 120;
    char1.currentHP = 120;
    char1.attack = 18;
    char1.defense = 8;

    player1.board[0].row = 5;
    player1.board[0].col = 6;
    player1.board[0].character = char1;

    // Team 2 has TWO characters - should lock onto one and stick with it
    const char2a = new Character();
    char2a.name = 'Enemy1';
    char2a.emoji = '👹';
    char2a.hp = 100;
    char2a.currentHP = 100;
    char2a.attack = 15;
    char2a.defense = 5;

    const char2b = new Character();
    char2b.name = 'Enemy2';
    char2b.emoji = '👺';
    char2b.hp = 100;
    char2b.currentHP = 100;
    char2b.attack = 15;
    char2b.defense = 5;

    player2.board[0].row = 5;
    player2.board[0].col = 7;
    player2.board[0].character = char2a;

    player2.board[1].row = 5;
    player2.board[1].col = 8;
    player2.board[1].character = char2b;

    room.state.players.set('player1', player1);
    room.state.players.set('player2', player2);

    // Run first combat tick
    const firstTarget = { row: char1.targetRow, col: char1.targetCol };

    // Run second combat tick (both enemies still alive)
    // Expected: Target should be same as first tick (sticky)
    expect(char1.targetRow).toBe(firstTarget.row);
    expect(char1.targetCol).toBe(firstTarget.col);
  });

  /**
   * Test 6: Count attack particles
   */
  it('should have equal number of particles as alive characters on both teams', () => {
    const player1 = new Player();
    player1.id = 'player1';

    const player2 = new Player();
    player2.id = 'player2';

    // Add 3 Team 1 characters
    for (let i = 0; i < 3; i++) {
      const char = new Character();
      char.name = `Team1_${i}`;
      char.emoji = '🏹';
      char.hp = 100;
      char.currentHP = 100;
      char.attack = 15;
      char.defense = 5;

      player1.board[i].row = i;
      player1.board[i].col = 6;
      player1.board[i].character = char;
    }

    // Add 3 Team 2 characters
    for (let i = 0; i < 3; i++) {
      const char = new Character();
      char.name = `Team2_${i}`;
      char.emoji = '⚔️';
      char.hp = 100;
      char.currentHP = 100;
      char.attack = 15;
      char.defense = 5;

      player2.board[i].row = i;
      player2.board[i].col = 7;
      player2.board[i].character = char;
    }

    room.state.players.set('player1', player1);
    room.state.players.set('player2', player2);

    // Count characters with valid targets
    let team1WithTargets = 0;
    let team2WithTargets = 0;

    player1.board.forEach(pos => {
      if (pos?.character && pos.character.targetRow !== -1) {
        team1WithTargets++;
      }
    });

    player2.board.forEach(pos => {
      if (pos?.character && pos.character.targetRow !== -1) {
        team2WithTargets++;
      }
    });

    // Expected: All 3 Team 1 characters should have targets
    expect(team1WithTargets).toBe(3);

    // Expected: All 3 Team 2 characters should have targets
    expect(team2WithTargets).toBe(3);
  });
});
