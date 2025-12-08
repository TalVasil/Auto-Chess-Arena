# RECONNECTION TEST SUITE

Comprehensive tests to verify server-side reconnection functionality.

---

## TEST 1: Single Refresh - Basic Reconnection

**Purpose**: Verify basic reconnection preserves state

**Steps**:
1. Start fresh server (Ctrl+C, `npm run dev`)
2. Login as user1 in browser tab 1
3. Login as user2 in browser tab 2
4. Both users ready up → game starts
5. User1: Buy 3 characters, place 1 on board
6. User1: Note gold amount, bench contents, board position
7. User1: Press F5 to refresh
8. Wait 2 seconds for reconnection

**Expected Server Logs**:
```
👋 Player [sessionId] left! (consented: false)
⏳ Player disconnected accidentally, keeping data for reconnection
🔧 Calling allowReconnection() for: [sessionId]
✅ Reconnection window opened for player: [sessionId]
✅ User logged in: [username]
✅ Player successfully reconnected: [sessionId]
   Restored state: { username: ..., gold: X, hp: 100, benchSize: 3 }
```

**Expected Client Behavior**:
- Same sessionId before and after refresh
- Same gold amount
- Same bench characters (3)
- Same board position
- No duplicate players

**Success Criteria**:
- ✅ Server shows "successfully reconnected"
- ✅ Client console shows "💾 Updated reconnection token after reconnection"
- ✅ Total players stays at 2/8
- ✅ State preserved

**Failure Indicators**:
- ❌ "reconnection token invalid or expired"
- ❌ "New player joining" (should be reconnecting)
- ❌ Total players increases to 3/8
- ❌ Fresh shop/gold

---

## TEST 2: Multiple Rapid Refreshes

**Purpose**: Verify token update mechanism works across multiple reconnections

**Steps**:
1. Continue from Test 1 (server still running)
2. User1: Press F5 (refresh #1)
3. Wait for successful reconnection
4. User1: Press F5 again (refresh #2)
5. Wait for successful reconnection
6. User1: Press F5 again (refresh #3)
7. Wait for successful reconnection
8. User1: Press F5 again (refresh #4)
9. Wait for successful reconnection
10. User1: Press F5 again (refresh #5)

**Expected Server Logs** (for EACH refresh):
```
👋 Player [sessionId] left! (consented: false)
✅ Reconnection window opened for player: [sessionId]
✅ Player successfully reconnected: [sessionId]
```

**Expected Client Console** (for EACH refresh):
```
🔄 Attempting to reconnect to previous game...
📖 Found saved reconnection token
🔄 Reconnecting with token...
✅ Reconnected successfully!
💾 Updated reconnection token after reconnection  ← CRITICAL
```

**Success Criteria**:
- ✅ All 5 refreshes reconnect successfully
- ✅ "💾 Updated reconnection token" appears 5 times
- ✅ Total players stays at 2/8
- ✅ Same sessionId throughout

**Failure Indicators**:
- ❌ Any "reconnection token invalid" errors
- ❌ Any "New player joining" messages
- ❌ Player count increases beyond 2/8

---

## TEST 3: Reconnection Window Expiration

**Purpose**: Verify players are removed after 5-minute timeout

**Steps**:
1. Start fresh server
2. Login as user1, join lobby
3. Note the sessionId from server logs
4. Close browser tab (don't logout)
5. Wait 6 minutes (use timer)
6. Check server logs

**Expected Server Logs**:
```
👋 Player [sessionId] left! (consented: false)
✅ Reconnection window opened for player: [sessionId]
... (5 minutes pass) ...
⏰ Reconnection window expired for: [sessionId]
```

**Expected Behavior**:
- Player removed from state after 5 minutes
- Room disposes if no players remain

**Success Criteria**:
- ✅ "Reconnection window expired" message appears
- ✅ Player count decreases
- ✅ Room disposes if empty

---

## TEST 4: Intentional Logout vs Accidental Disconnect

**Purpose**: Verify consented flag works correctly

**Steps**:
1. Start fresh server
2. Login as user1 in WAITING phase
3. Click "Logout" button
4. Check server logs

**Expected Server Logs**:
```
👋 Player [sessionId] left! (consented: true)
🚪 Player left intentionally, removing from game
👥 Total players: 0/8
```

**Expected Client Console**:
```
👋 Disconnecting from room
🚪 Intentional disconnect - clearing session
🗑️ Cleared saved session data
```

**Success Criteria**:
- ✅ consented: true
- ✅ Player removed immediately (not kept for reconnection)
- ✅ LocalStorage reconnection token cleared
- ✅ No "allowReconnection" call

**Failure Indicators**:
- ❌ consented: false
- ❌ "allowReconnection" called
- ❌ Player kept in state

---

## TEST 5: Reconnection Across Game Phases

**Purpose**: Verify reconnection works in all phases

**Test 5A - WAITING Phase**:
1. Login, stay in lobby
2. Refresh browser
3. Verify reconnect successful

**Test 5B - PREPARATION Phase**:
1. Start game, buy characters
2. Refresh during PREPARATION
3. Verify state preserved

**Test 5C - COMBAT Phase**:
1. Wait for COMBAT phase
2. Refresh during COMBAT
3. Verify state preserved

**Success Criteria** (for each phase):
- ✅ Reconnection successful
- ✅ Correct phase restored
- ✅ State preserved

---

## TEST 6: Multiple Players Reconnecting Simultaneously

**Purpose**: Verify system handles concurrent reconnections

**Steps**:
1. Start fresh server
2. Login user1 (tab 1), user2 (tab 2), user3 (tab 3)
3. Start game, all buy characters
4. **Simultaneously**: Refresh all 3 tabs at once (F5 on each)
5. Wait for reconnections

**Expected Server Logs**:
```
👋 Player [user1-sessionId] left! (consented: false)
👋 Player [user2-sessionId] left! (consented: false)
👋 Player [user3-sessionId] left! (consented: false)
✅ Player successfully reconnected: [user1-sessionId]
✅ Player successfully reconnected: [user2-sessionId]
✅ Player successfully reconnected: [user3-sessionId]
```

**Success Criteria**:
- ✅ All 3 players reconnect successfully
- ✅ Total players stays at 3/8
- ✅ No duplicates created

---

## TEST 7: Server Restart Handling

**Purpose**: Verify graceful handling of expired tokens after server restart

**Steps**:
1. Login user1, join game
2. **Restart server** (Ctrl+C, `npm run dev`)
3. Refresh browser
4. Check behavior

**Expected Server Logs**:
```
❌ room "[oldRoomId]" has been disposed
AutoChessRoom created! { token: '...' }
✅ Player [newSessionId] joined!
🆕 New player joining
```

**Expected Client Console**:
```
🔄 Attempting to reconnect to previous game...
❌ Reconnection failed: [error]
🗑️ Cleared saved session data
⚠️ Reconnection failed, joining new game instead...
🔌 Connecting to new game room...
✅ Connected to room: [newRoomId]
```

**Success Criteria**:
- ✅ Client detects expired token
- ✅ Client clears old token
- ✅ Client joins NEW game
- ✅ No errors thrown

**Failure Indicators**:
- ❌ Client gets stuck in error state
- ❌ User sees error message
- ❌ Token not cleared

---

## TEST 8: Reconnection with Timer Paused

**Purpose**: Verify timer state preserved during reconnection

**Steps**:
1. Start game
2. Pause timer (using your debug command)
3. Note timer value
4. Buy characters
5. Refresh browser
6. Check timer value

**Success Criteria**:
- ✅ Timer still paused after reconnection
- ✅ Timer value preserved
- ✅ Characters preserved

---

## TEST 9: Maximum Players with Reconnection

**Purpose**: Verify player count management with reconnections

**Steps**:
1. Join game with 8 players (full lobby)
2. Player 1 disconnects (refresh)
3. Check if player 1 can reconnect (should succeed - seat reserved)
4. New player 9 tries to join (should fail - room full)
5. Player 1 reconnects successfully

**Expected Behavior**:
- Player 1's seat is reserved during reconnection window
- New players cannot join while seats are reserved
- Player count never exceeds 8

**Success Criteria**:
- ✅ Player 1 reconnects successfully
- ✅ Player 9 cannot join (room full)
- ✅ Total players never exceeds 8/8

**CURRENT BUG**:
- ❌ Logs show "👥 Total players: 10/8"
- ❌ Room accepts more than maxClients

---

## TEST 10: Network Interruption Simulation

**Purpose**: Verify automatic reconnection on network issues

**Steps**:
1. Start game
2. Open browser DevTools → Network tab
3. Set network to "Offline"
4. Wait 2 seconds
5. Set network back to "Online"
6. Check if auto-reconnect triggers

**Expected Client Console**:
```
👋 Left room, code: 1006
⚠️ Accidental disconnect - keeping session for reconnection
🔄 Reconnection attempt 1/5 in 1s...
🔄 Attempting reconnection (attempt 1)...
✅ Reconnected successfully!
```

**Success Criteria**:
- ✅ Client detects disconnect (code !== 1000)
- ✅ Client keeps reconnection token
- ✅ Client auto-reconnects with exponential backoff
- ✅ State preserved

---

## DIAGNOSTIC COMMANDS

### Check Player Count:
```typescript
// Add to server debug command
this.onMessage('debug_players', (client) => {
  console.log('🔍 Player count:', this.state.players.size);
  this.state.players.forEach((player, sessionId) => {
    console.log(`  - ${sessionId}: ${player.username}`);
  });
});
```

### Check LocalStorage Token:
```javascript
// Run in browser console
console.log('Reconnection token:', localStorage.getItem('colyseusReconnectionToken'));
```

### Force Clear Token:
```javascript
// Run in browser console
localStorage.removeItem('colyseusReconnectionToken');
console.log('Token cleared');
```

---

## KNOWN ISSUES TO FIX

### Issue 1: Player Count Exceeding Maximum
**Evidence**: `👥 Total players: 10/8`
**Root Cause**: Disconnected players not being removed from state when reconnection window expires
**Fix**: Need to implement cleanup in `onLeave` catch block

### Issue 2: Intermittent Token Failures
**Evidence**: Success → Success → Fail pattern
**Root Cause**: Token update might be failing silently in some cases
**Fix**: Add error handling and logging to token save

### Issue 3: Reconnection Window Not Cleaning Up
**Evidence**: Multiple "window expired" messages with players still in state
**Root Cause**: `.catch()` handler on allowReconnection promise needs to remove player
**Fix**: Implement player removal in the catch block

---

## SUCCESS METRICS

**Reconnection is working correctly when**:
- ✅ 100% success rate on Tests 1-2 (basic + multiple refreshes)
- ✅ Proper cleanup on Test 3 (expiration)
- ✅ Correct consented handling on Test 4
- ✅ All phases work on Test 5
- ✅ Concurrent reconnects work on Test 6
- ✅ Graceful degradation on Test 7 (server restart)
- ✅ Timer state preserved on Test 8
- ✅ Player count never exceeds 8/8 on Test 9
- ✅ Auto-reconnect works on Test 10

**Current Status**:
- ❌ Tests 1-2: Intermittent failures
- ❌ Test 3: Expired players not removed
- ❌ Test 9: Player count exceeds maximum
- ✅ Test 4: Intentional logout works
- ❓ Tests 5-8, 10: Need testing
