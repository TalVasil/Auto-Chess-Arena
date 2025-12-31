# Auto Chess Arena - Reconnection & Recovery Test Plan

## Overview
This document contains comprehensive tests to verify that game state recovery works correctly in all scenarios. Players should never lose data regardless of browser refresh, server crash, or network issues.

---

## What Should Be Preserved

When a player reconnects, ALL of the following must be preserved:
- ✅ HP (Health Points)
- ✅ Gold
- ✅ XP (Experience Points)
- ✅ Level
- ✅ Bench characters (all 10 slots, with exact positions)
- ✅ Board/Arena characters (exact positions with row/col)
- ✅ Shop characters (the 5 characters currently offered)
- ✅ Current phase (WAITING, PREPARATION, COMBAT)
- ✅ Round number
- ✅ Timer (approximate - may differ by a few seconds)
- ✅ Opponent information (if in COMBAT phase)
- ✅ Character stats (attack, defense, HP, stars)

---

## Test Suite 1: Browser Refresh During COMBAT Phase

### Test 1.1: Fast Refresh (< 30 minutes) ⭐ CRITICAL
**Purpose:** Verify reconnection with valid token (same session ID)

**Setup:**
1. Start game with 2 players (Player A and Player B)
2. Both players click "Ready"
3. Wait for COMBAT phase to start
4. Verify both players see opponent arenas

**Test Steps:**
1. Player A: Press F5 or Ctrl+R to refresh browser
2. Wait for reconnection (should be < 2 seconds)

**Expected Results:**
- ✅ Player A reconnects automatically
- ✅ Player A sees their own data (HP, gold, XP, level, bench, board)
- ✅ Player A sees Player B's arena on the LEFT side of screen
- ✅ Player B still sees Player A's arena on the RIGHT side (no interruption)
- ✅ Server console shows: `📤 Sent combat matchup to reconnected player (same session)`
- ✅ Player A console shows: `🎯 Round X: I'm fighting [Player B display name]`
- ✅ Combat timer continues (may be slightly out of sync, acceptable)

**How to Verify:**
- Check HP, Gold, XP values match pre-refresh
- Count bench characters (should be same number)
- Count board characters (should be same positions)
- Verify opponent name displays correctly
- Verify opponent's units appear on left side of arena

---

### Test 1.2: Both Players Refresh Simultaneously
**Purpose:** Verify system handles multiple simultaneous reconnections

**Setup:**
1. Same as Test 1.1 (2 players in COMBAT)

**Test Steps:**
1. Player A AND Player B: Both press F5 at the same time
2. Wait for both to reconnect

**Expected Results:**
- ✅ Both players reconnect successfully
- ✅ Both players see each other's arenas
- ✅ Combat continues normally
- ✅ No server errors or crashes

---

### Test 1.3: Refresh During Different Combat Rounds
**Purpose:** Verify matchups update correctly across rounds

**Setup:**
1. Start game with at least 3 players
2. Enter COMBAT phase (Round 1)

**Test Steps:**
1. Round 1 COMBAT: Player A refresh → verify sees opponent
2. Wait for Round 2 COMBAT to start
3. Round 2 COMBAT: Player A refresh → verify sees (possibly different) opponent
4. Wait for Round 3 COMBAT to start
5. Round 3 COMBAT: Player A refresh → verify sees opponent

**Expected Results:**
- ✅ Each round, opponent arena shows the CORRECT opponent for that round
- ✅ If matchups change between rounds, opponent updates correctly
- ✅ Round number displayed is correct

---

## Test Suite 2: Browser Refresh During PREPARATION Phase

### Test 2.1: Refresh During Preparation Phase
**Purpose:** Verify reconnection works between combat rounds

**Setup:**
1. Start game with 2 players
2. Play through Round 1 COMBAT
3. Wait for PREPARATION phase to start

**Test Steps:**
1. Player A: Refresh browser during PREPARATION phase
2. Verify reconnection

**Expected Results:**
- ✅ Player A reconnects successfully
- ✅ Player A sees their bench (with all previous characters)
- ✅ Player A sees their shop (5 characters)
- ✅ Player A sees correct gold, XP, level, HP
- ✅ NO opponent arena shown (correct - not in combat)
- ✅ Can buy characters from shop
- ✅ Can place characters on board
- ✅ Timer continues counting down
- ✅ When COMBAT starts, opponent arena appears correctly

---

## Test Suite 3: Token Expiry Scenario (> 30 minutes offline)

### Test 3.1: Simulated Token Expiry ⭐ CRITICAL
**Purpose:** Verify session transfer works when reconnection token expires

**Setup:**
1. Start game with 2 players in COMBAT phase
2. Player A: Open browser DevTools Console (F12)
3. Player A: Note current session ID from console logs

**Test Steps:**
1. Player A: In console, run: `localStorage.removeItem('colyseusReconnectionToken')`
2. Player A: Refresh browser (F5)
3. Observe server logs and client console

**Expected Results:**

**Client Console:**
- ✅ Shows: `⚠️ Token-based reconnection failed, trying recovery methods...`
- ✅ Shows: `🔄 No server restart detected, will try joining original room...`
- ✅ Shows: `✅ Reconnected via session transfer!`
- ✅ Shows: `🎯 Round X: I'm fighting [opponent name]`

**Server Console:**
- ✅ Shows: `🔄 User [name] reconnection token expired, transferring session oldID → newID`
- ✅ Shows: `Updated matchup player1Id: oldID → newID` (or player2Id)
- ✅ Shows: `✅ Player data transferred! Preserved: HP=X, Gold=Y, XP=Z, Bench=N, Board=M`
- ✅ Shows: `📤 Sent matchups to reconnected player + broadcast to others`

**Game State:**
- ✅ Player A has NEW session ID (check console)
- ✅ Player A sees all their data preserved
- ✅ Player A sees opponent arena
- ✅ Player B sees Player A's arena (with updated session ID)
- ✅ Both players can continue playing

---

## Test Suite 4: Server Restart Recovery

### Test 4.1: Server Crash During COMBAT ⭐ CRITICAL
**Purpose:** Verify full recovery after server restart

**Setup:**
1. Start game with 2+ players
2. Enter COMBAT phase
3. Server terminal: Note the current room ID from logs

**Test Steps:**
1. Server: Press Ctrl+C to stop server
2. Server: Run `npm run dev` to restart server
3. Wait for server startup messages
4. Verify recovery logs
5. Player A: Refresh browser
6. Player B: Refresh browser

**Expected Server Logs:**
```
🔄 RECOVERY: Found X active game session(s) to recover...
   Recovering room ABC123...
🔄 RECOVERY MODE: Restoring game from snapshot...
   ✅ Restored player: PlayerName (HP: 100, Gold: 21)
   ✅ Restored player: PlayerName2 (HP: 95, Gold: 15)
   ✅ Restored 1 matchups
✅ Room recovered! Players: 2, Phase: COMBAT
🔗 Mapped room ID: ABC123 → XYZ789
   ✅ Room recovered: ABC123 → XYZ789
```

**Expected Client Behavior (Player A):**
- ✅ Console shows: `✅ Server was restarted - found new room: ABC123 → XYZ789`
- ✅ Console shows: `🎉 Successfully recovered game after server restart!`
- ✅ Player A sees all data preserved
- ✅ Player A sees opponent arena

**Expected Client Behavior (Player B):**
- ✅ Same as Player A
- ✅ Both players see each other's arenas

**Game State:**
- ✅ New room ID (different from original)
- ✅ All players have new session IDs
- ✅ All player data preserved (HP, gold, bench, board)
- ✅ Matchups updated to new session IDs
- ✅ Combat continues from where it left off
- ✅ Round number correct
- ✅ Timer approximate (acceptable variance)

---

### Test 4.2: Server Crash During PREPARATION Phase
**Purpose:** Verify recovery works in non-combat phases

**Setup:**
1. Start game with 2 players
2. Get to PREPARATION phase
3. Note room ID

**Test Steps:**
1. Stop server (Ctrl+C)
2. Restart server (`npm run dev`)
3. Both players refresh

**Expected Results:**
- ✅ Server recovers room in PREPARATION phase
- ✅ Players reconnect to new room ID
- ✅ Can continue buying/arranging units
- ✅ Timer continues
- ✅ Shop characters preserved
- ✅ Next combat round starts normally

---

## Test Suite 5: Edge Cases

### Test 5.1: One Player Offline, Other Continues
**Purpose:** Verify offline player can catch up to game state

**Setup:**
1. Two players in COMBAT phase

**Test Steps:**
1. Player A: Close browser completely (don't just refresh)
2. Player B: Continue playing, wait for next round (PREPARATION → COMBAT)
3. Player A: After 2 minutes, reopen browser and navigate to game
4. Player A: Should auto-reconnect

**Expected Results:**
- ✅ Player A reconnects successfully
- ✅ Player A sees CURRENT round (not the round they left)
- ✅ Player A's data preserved from when they left
- ✅ Game state caught up to current state
- ✅ If in COMBAT, sees current opponent

---

### Test 5.2: Refresh During Phase Transition
**Purpose:** Verify race condition handling

**Setup:**
1. Two players in COMBAT with timer at 5 seconds

**Test Steps:**
1. Player A: Watch timer countdown
2. Player A: Press F5 when timer shows 1 or 0 seconds (during phase change)
3. Observe behavior

**Expected Results:**
- ✅ Player A reconnects to whichever phase server is in
- ✅ No crashes or errors
- ✅ Data consistent
- ✅ If phase changed during reconnect, sees new phase

---

### Test 5.3: Multiple Refreshes in Quick Succession
**Purpose:** Verify duplicate connection prevention

**Setup:**
1. Two players in COMBAT

**Test Steps:**
1. Player A: Press F5 three times rapidly (F5, F5, F5)
2. Observe console logs

**Expected Results:**
- ✅ Console shows: `⚠️ Connection already in progress, skipping duplicate call`
- ✅ Only one connection is established
- ✅ Eventually reconnects successfully
- ✅ No duplicate players in game

---

## Test Suite 6: Data Integrity Verification

### Test 6.1: Verify All Fields Preserved ⭐ CRITICAL
**Purpose:** Detailed check of every field

**Setup:**
1. Player A: Buy 3 characters, place 2 on board, keep 1 on bench
2. Note EXACT values before refresh:
   - HP: _____
   - Gold: _____
   - XP: _____
   - Level: _____
   - Bench characters: _____ (count and names)
   - Board characters: _____ (count, names, and positions)
   - Shop characters: _____ (names of all 5)
3. Enter COMBAT phase

**Test Steps:**
1. Player A: Refresh browser
2. Verify each field

**Expected Results:**
- ✅ HP: Exact same value
- ✅ Gold: Exact same value
- ✅ XP: Exact same value
- ✅ Level: Exact same value
- ✅ Bench: Same characters in same positions
- ✅ Board: Same characters in same grid positions (row/col)
- ✅ Shop: Same 5 characters offered
- ✅ Opponent arena: Shows opponent's units in correct positions

**Verification Checklist:**
```
Before Refresh          | After Refresh           | Match?
------------------------|-------------------------|--------
HP: ______             | HP: ______             | [ ]
Gold: ______           | Gold: ______           | [ ]
XP: ______             | XP: ______             | [ ]
Level: ______          | Level: ______          | [ ]
Bench Count: ______    | Bench Count: ______    | [ ]
Board Count: ______    | Board Count: ______    | [ ]
Shop: ____________     | Shop: ____________     | [ ]
Opponent Visible: Y/N  | Opponent Visible: Y/N  | [ ]
```

---

### Test 6.2: Verify Character Stats Preserved
**Purpose:** Ensure character-level data persists

**Setup:**
1. Buy multiple copies of same character to trigger star upgrade (if implemented)
2. Note character stars/levels

**Test Steps:**
1. Refresh browser

**Expected Results:**
- ✅ Character stars preserved (1-star, 2-star, 3-star)
- ✅ Character stats preserved (attack, defense, HP)
- ✅ Character positions preserved

---

## Test Suite 7: BYE Round Handling

### Test 7.1: Reconnect During BYE Round
**Purpose:** Verify BYE rounds work correctly on reconnect

**Setup:**
1. Start game with 3 players (odd number - ensures one BYE)
2. Enter COMBAT phase
3. Server console: Identify which player got BYE
   - Look for: `🛡️ Player [sessionId] gets a BYE round`

**Test Steps:**
1. BYE player: Refresh browser
2. Check console and UI

**Expected Results:**
- ✅ BYE player reconnects successfully
- ✅ Client console shows: `🛡️ Round X: I have a BYE round (no opponent)`
- ✅ `myOpponentId` is null (check in browser DevTools)
- ✅ UI shows NO opponent arena
- ✅ UI optionally shows "You have a BYE round" message
- ✅ BYE player still sees their own board
- ✅ BYE player's HP/gold/data preserved

---

### Test 7.2: Non-BYE Player Reconnects (Odd Number Game)
**Purpose:** Verify fighting players still see opponents when one has BYE

**Setup:**
1. Start game with 3 players (A, B, C)
2. Enter COMBAT phase
3. Players A and B are fighting each other
4. Player C has BYE

**Test Steps:**
1. Player A: Refresh browser
2. Verify Player A and Player B still see each other

**Expected Results:**
- ✅ Player A reconnects
- ✅ Player A sees Player B's arena
- ✅ Player B sees Player A's arena
- ✅ Player C still has BYE (no opponent)
- ✅ All three players have correct data

---

## Test Suite 8: Network Interruption Scenarios

### Test 8.1: Disconnect and Reconnect
**Purpose:** Simulate temporary network loss

**Setup:**
1. Two players in COMBAT

**Test Steps:**
1. Player A: Open browser DevTools → Network tab
2. Player A: Click "Offline" mode
3. Wait 5 seconds
4. Player A: Click "Online" mode
5. Observe auto-reconnection

**Expected Results:**
- ✅ Client detects disconnection
- ✅ Client automatically attempts reconnection
- ✅ Reconnection succeeds
- ✅ Game state preserved

---

## Critical Success Metrics

For the reconnection system to be considered **WORKING**, these must ALL pass:

### ⭐ Must Pass:
1. ✅ Test 1.1 - Fast refresh during combat
2. ✅ Test 3.1 - Token expiry (session transfer)
3. ✅ Test 4.1 - Server restart recovery
4. ✅ Test 6.1 - All fields preserved

### Important:
5. ✅ Test 1.2 - Both players refresh
6. ✅ Test 2.1 - Refresh during preparation
7. ✅ Test 7.1 - BYE round handling

### Nice to Have:
8. ✅ All edge cases (Suite 5)
9. ✅ Network interruption (Suite 8)

---

## Known Issues / Acceptable Limitations

Document any known issues here:

1. **Timer Sync**: Timer may be off by 1-3 seconds after reconnect (acceptable)
2. **Animation State**: Combat animations restart on reconnect (acceptable)
3. **Reconnection Delay**: May take 1-2 seconds to establish connection (acceptable)

---

## Bug Reporting Template

If any test fails, use this template to report:

```
**Test Failed:** [Test number and name]

**Steps to Reproduce:**
1.
2.
3.

**Expected:**
-

**Actual:**
-

**Server Logs:**
```
[paste server console output]
```

**Client Logs:**
```
[paste browser console output]
```

**Screenshots:**
[attach if applicable]

**Environment:**
- Browser: [Chrome/Firefox/etc]
- Server Version: [commit hash or date]
- Number of Players: [2/3/4/etc]
```

---

## Test Execution Tracking

Use this checklist to track test completion:

```
Test Suite 1: Browser Refresh During COMBAT
  [ ] Test 1.1 - Fast Refresh ⭐
  [ ] Test 1.2 - Both Players Refresh
  [ ] Test 1.3 - Refresh During Different Rounds

Test Suite 2: Browser Refresh During PREPARATION
  [ ] Test 2.1 - Refresh During Preparation

Test Suite 3: Token Expiry
  [ ] Test 3.1 - Simulated Token Expiry ⭐

Test Suite 4: Server Restart Recovery
  [ ] Test 4.1 - Server Crash During COMBAT ⭐
  [ ] Test 4.2 - Server Crash During PREPARATION

Test Suite 5: Edge Cases
  [ ] Test 5.1 - One Player Offline
  [ ] Test 5.2 - Refresh During Phase Transition
  [ ] Test 5.3 - Multiple Rapid Refreshes

Test Suite 6: Data Integrity
  [ ] Test 6.1 - All Fields Preserved ⭐
  [ ] Test 6.2 - Character Stats Preserved

Test Suite 7: BYE Round Handling
  [ ] Test 7.1 - Reconnect During BYE Round
  [ ] Test 7.2 - Non-BYE Player in Odd Game

Test Suite 8: Network Interruption
  [ ] Test 8.1 - Disconnect and Reconnect
```

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-12-31 | 1.0 | Initial test plan created | Claude |

