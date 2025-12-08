# SERVER-SIDE RECONNECTION WORK PLAN

Complete guide for implementing server-side reconnection in Colyseus Auto Chess game.

---

## OVERVIEW

**Goal**: Allow players to rejoin their game after accidental disconnects (browser refresh, network issues, etc.)

**Key Concepts**:
- When a player disconnects, DON'T immediately delete their data
- Keep their player data for a "grace period" (5-10 minutes)
- Allow them to reconnect using their reconnection token
- Clean up after grace period expires

---

## PHASE 1: Enable Colyseus Reconnection (2 Steps)

### Step 1: Configure room to allow reconnection
**File:** `server/src/rooms/AutoChessRoom.ts`
**Location:** Top of the class, in `onCreate()` method
**Action:** Set room options to enable reconnection

**What to add:**
```typescript
async onCreate(options: any) {
  // Enable reconnection - keep seat reserved for 5 minutes (300 seconds)
  this.setSeatReservationTime(300);

  // ... rest of existing onCreate code
}
```

**Why**: This tells Colyseus to keep the player's "seat" reserved for 300 seconds (5 minutes) after they disconnect.

---

### Step 2: Modify onLeave to handle reconnection
**File:** `server/src/rooms/AutoChessRoom.ts`
**Location:** `onLeave()` method
**Action:** Check if disconnect allows reconnection

**Current code** (probably looks like this):
```typescript
async onLeave(client: Client) {
  console.log('Player disconnected:', client.sessionId);

  // Delete player from state
  this.state.players.delete(client.sessionId);
}
```

**New code**:
```typescript
async onLeave(client: Client, consented: boolean) {
  console.log('Player disconnected:', client.sessionId, 'consented:', consented);

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
    this.state.players.delete(client.sessionId);
  } else {
    // Accidental disconnect - keep player data for reconnection
    console.log('⏳ Player disconnected accidentally, keeping data for reconnection');
    // Player data stays in this.state.players
    // Colyseus will automatically clean it up after seat reservation time expires
  }
}
```

**Why**: The `consented` parameter tells us if the player left intentionally (true) or accidentally (false).

---

## PHASE 2: Handle Reconnection (2 Steps)

### Step 3: Add onJoin logic to detect reconnection
**File:** `server/src/rooms/AutoChessRoom.ts`
**Location:** `onJoin()` method
**Action:** Check if player is reconnecting or joining new

**Current code** (probably looks like this):
```typescript
async onJoin(client: Client, options: any) {
  console.log('Player joined:', client.sessionId);

  // Create new player
  const newPlayer = new Player();
  newPlayer.id = client.sessionId;
  newPlayer.username = options.username || 'Guest';
  // ... set other properties

  this.state.players.set(client.sessionId, newPlayer);
}
```

**New code**:
```typescript
async onJoin(client: Client, options: any) {
  console.log('Player joined:', client.sessionId);

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
    // Player data is already in state, nothing to do!
    return;
  }

  // NEW PLAYER - create new player data
  console.log('🆕 New player joining:', client.sessionId);

  const newPlayer = new Player();
  newPlayer.id = client.sessionId;
  newPlayer.username = options.username || 'Guest';
  newPlayer.hp = 100;
  newPlayer.gold = 0;
  newPlayer.xp = 0;
  newPlayer.level = 1;
  newPlayer.isReady = false;
  newPlayer.isEliminated = false;

  this.state.players.set(client.sessionId, newPlayer);
}
```

**Why**: When a player reconnects, their data is still in `this.state.players`. We just need to recognize them and NOT create duplicate data.

---

### Step 4: Test reconnection is working
**Action:** Manual testing to verify server behavior

**Test Steps**:
1. Start server and client
2. Join a game lobby
3. Buy some characters (so you have data to preserve)
4. Refresh browser (F5)
5. Check server console for:
   ```
   Player disconnected: [sessionId] consented: false
   ⏳ Player disconnected accidentally, keeping data for reconnection
   Player joined: [sessionId]
   ✅ Player reconnected: [sessionId]
   Restored state: { username: ..., gold: ..., benchSize: ... }
   ```
6. Check client - you should still have your characters!

---

## PHASE 3: Handle Edge Cases (3 Steps)

### Step 5: Clean up expired reconnection data
**File:** `server/src/rooms/AutoChessRoom.ts`
**Location:** Create new method
**Action:** Add cleanup logic for players who never reconnected

**What to add:**
```typescript
// Called when seat reservation expires (player didn't reconnect in time)
async onDispose() {
  console.log('🧹 Room disposing, cleaning up...');

  // Colyseus handles this automatically
  // But we can add extra cleanup here if needed
}
```

**Why**: Colyseus automatically removes disconnected players after the seat reservation time expires. This method lets us add custom cleanup if needed.

---

### Step 6: Handle reconnection during different game phases
**File:** `server/src/rooms/AutoChessRoom.ts`
**Location:** `onJoin()` method (update Step 3)
**Action:** Handle reconnection for different game phases

**Add to Step 3 code:**
```typescript
if (existingPlayer) {
  console.log('✅ Player reconnected:', client.sessionId);

  // If game already started, need to resync game state
  if (this.state.phase !== 'WAITING') {
    console.log('   Reconnecting during', this.state.phase, 'phase');
    // The state sync happens automatically via Colyseus
    // Client will receive full state update on reconnection
  }

  return;
}
```

**Why**: When reconnecting during an active game, Colyseus automatically sends the full state to the client. We just log it for debugging.

---

### Step 7: Update client disconnect to send "consented" signal
**File:** `client/src/network/GameClient.ts`
**Location:** `disconnect()` method
**Action:** Tell server this is intentional disconnect

**Current code:**
```typescript
disconnect() {
  if (this.room) {
    console.log('👋 Disconnecting from room');
    this.room.leave();
    this.room = null;
    this.setStatus('disconnected');
  }
}
```

**New code:**
```typescript
disconnect() {
  if (this.room) {
    console.log('👋 Disconnecting from room');
    this.room.leave(true); // true = consented (intentional)
    this.room = null;
    this.setStatus('disconnected');
  }
}
```

**Why**: `room.leave(true)` tells the server this is an intentional disconnect. The server's `onLeave(client, consented)` will receive `consented = true`.

---

## PHASE 4: End-to-End Testing (5 Tests)

### Test 1: Reconnect after browser refresh during WAITING phase
**Steps**:
1. Join lobby (WAITING phase)
2. Press F5 to refresh
3. **Expected**: Reconnect successfully, still in same lobby

---

### Test 2: Reconnect after browser refresh during PREPARATION phase
**Steps**:
1. Game starts (PREPARATION phase)
2. Buy 2-3 characters
3. Note your gold amount
4. Press F5 to refresh
5. **Expected**: Reconnect successfully, characters and gold preserved

---

### Test 3: Intentional disconnect clears data
**Steps**:
1. Join lobby
2. Click "Logout" button
3. Login again
4. **Expected**: Join NEW game (not same lobby)

---

### Test 4: Reconnection expires after timeout
**Steps**:
1. Join lobby
2. Close browser tab
3. Wait 6 minutes (longer than 5-minute grace period)
4. Open browser and login
5. **Expected**: Join NEW game (old session expired)

---

### Test 5: Multiple rapid refreshes
**Steps**:
1. Join lobby
2. Press F5 three times quickly
3. **Expected**: No errors, reconnect successfully each time

---

## KEY FILES TO MODIFY

### Server Files:
1. `server/src/rooms/AutoChessRoom.ts` - Main reconnection logic
   - `onCreate()` - Set seat reservation time
   - `onLeave()` - Handle disconnect (keep or remove player)
   - `onJoin()` - Detect reconnection vs new player

### Client Files (Already Done ✅):
1. ✅ `client/src/network/GameClient.ts` - Reconnection token handling
2. ✅ `client/src/store/gameStore.ts` - Attempt reconnection on load

### One Small Client Fix Needed:
- `client/src/network/GameClient.ts` - `disconnect()` method (Step 7)

---

## CONFIGURATION SETTINGS

### Reconnection Grace Period Options:
- **5 minutes (300s)** - Recommended for development
- **10 minutes (600s)** - Recommended for production
- **2 minutes (120s)** - Shorter for testing

Change in Step 1:
```typescript
this.setSeatReservationTime(300); // Change this number
```

---

## CURRENT STATUS

### Client-Side: ✅ COMPLETE
- Reconnection token saved
- Automatic reconnection on page load
- Exponential backoff retry logic

### Server-Side: ⏳ NEEDS IMPLEMENTATION
- Phase 1: ⏳ Not Started
- Phase 2: ⏳ Not Started
- Phase 3: ⏳ Not Started
- Phase 4: ⏳ Not Started

---

## NEXT STEP

**Start with Phase 1, Step 1**: Add `setSeatReservationTime()` to enable reconnection!
