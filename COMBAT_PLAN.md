# Combat System Implementation Plan - Client-First Approach

## Goal
Implement automatic combat where characters attack each other during COMBAT phase, characters die and vanish when HP reaches 0, and players lose HP when all their characters die.

## Technologies & Patterns
- **Colyseus Schema Sync**: Modify `this.state` properties → auto-syncs to all clients
- **Event Broadcasting**: `this.broadcast('event', data)` for attack/death animations
- **Client HP Bars**: Already implemented in Arena.tsx (lines 72-94)
- **Combat Phase**: Triggered at AutoChessRoom.ts:1291 (30-second duration)

## Baby Steps Plan - Client-First for Fast Feedback

### Step 1: Add `currentHP` to Character Schema ✅
**Goal**: Characters can track HP separately from max HP

**Server Changes**:
- Add `@type('number') currentHP: number = 0;` to Character class in `server/src/schema/GameState.ts`
- Initialize `currentHP = hp` when character is created/placed

**Client Changes**:
- None needed - Arena.tsx already reads `currentHP` (line 76)

**Test**: Refresh client, check Arena.tsx displays HP correctly

---

### Step 2: Mock HP Updates from Server ✅
**Goal**: See HP bars decrease in real-time on client

**Server Changes**:
- ✅ Added mock combat interval in AutoChessRoom.ts:1302-1326
- ✅ **CRITICAL FIX**: Clone Character objects to trigger Colyseus change detection
  ```typescript
  const updatedChar = new Character();
  Object.assign(updatedChar, pos.character);
  updatedChar.currentHP = Math.max(0, pos.character.currentHP - 10);
  pos.character = updatedChar; // Reassign triggers sync
  ```
- ✅ Store interval reference and clear it when combat ends
- ✅ Clear interval on room disposal to prevent memory leaks

**Client Changes**:
- None needed - Colyseus auto-syncs schema changes

**Test**: ✅ WORKING - HP bars decrease every 2 seconds and stop when combat ends

**Lessons Learned**:
- Direct property modification (`pos.character.currentHP -= 10`) doesn't trigger Colyseus sync
- Must create new Character instance and reassign to trigger change detection
- Must clear intervals to prevent them from running indefinitely

---

### Step 3: Character Death & Vanish
**Goal**: Characters disappear when HP reaches 0

**Server Changes**:
- When `currentHP <= 0`, set board position to null:
  ```typescript
  if (character.currentHP <= 0) {
    player.board[i] = null; // Character vanishes
  }
  ```

**Client Changes**:
- None needed - Arena.tsx already handles null positions

**Test**: HP drops to 0 → character vanishes from board

---

### Step 4: Broadcast Death Events (Optional Visual Feedback)
**Goal**: Client shows death animation/effect before vanish

**Server Changes**:
- Before setting board position to null:
  ```typescript
  this.broadcast('character_death', {
    playerId: player1Id,
    position: i,
    characterId: character.id
  });
  ```

**Client Changes**:
- In gameStore.ts, add listener:
  ```typescript
  room.onMessage('character_death', (data) => {
    // Show death effect (fade out, etc.)
  });
  ```

**Test**: Character death triggers visual effect before vanishing

---

### Step 5: Basic Attack Logic (Turn-Based) ✅
**Goal**: Characters attack each other automatically

**Implemented in baby steps:**
- 5.1 ✅ Distance calculation (Manhattan distance)
- 5.2 ✅ First character finds nearest enemy
- 5.3a ✅ Calculate damage for first character
- 5.3b ✅ Apply damage to HP for first character
- 5.4 ✅ ALL characters find targets (with sticky targeting)
- 5.5 ✅ ALL characters attack and deal damage

**Server Changes**:
- ✅ Implemented Manhattan distance calculation: `Math.abs(row1 - row2) + Math.abs(col1 - col2)`
- ✅ Sticky targeting system: Characters lock onto a target until it dies (prevents chaotic switching)
- ✅ Attack loop runs every 2 seconds
- ✅ Both teams attack simultaneously
- ✅ Damage calculation: `Math.max(1, attacker.attack - target.defense)`
- ✅ Clone and reassign Character to trigger Colyseus sync
- ✅ Attack logs show: attacker → target : (distance) dealt X dmg (HP: old → new)

**Client Changes**:
- None needed - HP bars auto-update via Colyseus sync

**Test**: ✅ WORKING - All characters attack nearest enemies with sticky targeting, HP decreases correctly

**Known Issue**: Dead characters (HP = 0) are still being targeted. Need to filter them out in next step.

---

### Step 6: Combat End Detection
**Goal**: Combat ends when one team is eliminated

**Server Changes**:
- After each attack round, check:
  ```typescript
  const team1Alive = team1.filter(pos => pos.character.currentHP > 0);
  const team2Alive = team2.filter(pos => pos.character.currentHP > 0);

  if (team1Alive.length === 0 || team2Alive.length === 0) {
    clearInterval(attackInterval);
    // Proceed to damage calculation
  }
  ```

**Client Changes**:
- None needed

**Test**: All characters die → combat stops → phase transitions

---

### Step 7: Player HP Damage
**Goal**: Losing player loses HP equal to surviving enemy units

**Server Changes**:
- After combat ends:
  ```typescript
  if (team1Alive.length === 0) {
    // Player 1 lost
    player1.hp -= team2Alive.length;
  } else if (team2Alive.length === 0) {
    // Player 2 lost
    player2.hp -= team1Alive.length;
  }
  ```

**Client Changes**:
- PlayerStats.tsx already displays player HP (if it exists in schema)

**Test**: Lose combat → player HP decreases by survivor count

---

### Step 8: Reconnection Safety
**Goal**: Combat state persists through disconnects

**Server Changes**:
- Combat state already in schema (board, HP) → auto-saved in snapshots
- Attack intervals need to be stored and recreated:
  ```typescript
  // Store interval ID in room
  this.combatIntervalId = setInterval(...);

  // On reconnect, check if combat is active
  onJoin(client, options) {
    if (this.state.phase === 'COMBAT' && !this.combatIntervalId) {
      // Resume combat
    }
  }
  ```

**Client Changes**:
- None needed - reconnection already handled

**Test**: Disconnect during combat → reconnect → combat continues

---

### Step 9: Full Combat Round Flow
**Goal**: Multiple combat rounds per game

**Server Changes**:
- After combat ends, reset character HP:
  ```typescript
  // Reset all characters to max HP
  players.forEach(player => {
    player.board.forEach(pos => {
      if (pos?.character) {
        pos.character.currentHP = pos.character.hp;
      }
    });
  });
  ```
- Transition back to PREPARATION phase
- Increment round number

**Client Changes**:
- None needed

**Test**: Combat ends → PREPARATION phase → Combat starts again with reset HP

---

## Key Implementation Notes

1. **Colyseus Sync Pattern**:
   - Modify schema properties directly: `character.currentHP -= damage`
   - Colyseus automatically syncs to all clients
   - Client HP bars update automatically

2. **Event Broadcasting Pattern**:
   - Use `this.broadcast()` for visual-only events (attacks, deaths)
   - NOT required for HP sync (schema handles it)
   - Client listens with `room.onMessage()`

3. **Where to Implement**:
   - Main combat logic: `AutoChessRoom.ts` line 1291 (TODO location)
   - Schema changes: `GameState.ts` Character class
   - Client listeners: `gameStore.ts` (if needed for animations)

4. **Testing Strategy**:
   - Each step is independently testable
   - Start with Step 2 mock to see HP bars working
   - Gradually add complexity (attacks, deaths, player damage)

5. **Reconnection**:
   - Schema state (HP, board positions) auto-persists in PostgreSQL snapshots
   - Combat interval IDs need manual recreation on server restart

## Priority Order
1. Steps 1-3: Core HP system (client can see HP decrease and characters vanish)
2. Steps 5-6: Combat logic (automatic attacks and win detection)
3. Step 7: Player damage
4. Steps 4, 8-9: Polish and edge cases
