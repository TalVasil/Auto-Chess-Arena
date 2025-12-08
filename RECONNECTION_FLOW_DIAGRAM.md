# Reconnection Flow Diagram

## Professional Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         RECONNECTION SYSTEM                              │
│                     Auto Chess Arena - Colyseus                          │
└─────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐                                  ┌──────────────────┐
│                  │                                  │                  │
│     CLIENT       │◄────── WebSocket ──────────────►│     SERVER       │
│   (React App)    │                                  │  (Colyseus Room) │
│                  │                                  │                  │
└──────────────────┘                                  └──────────────────┘
```

---

## Flow 1: Initial Connection

```
┌─────────────┐                                        ┌─────────────┐
│   Browser   │                                        │   Server    │
└──────┬──────┘                                        └──────┬──────┘
       │                                                      │
       │ 1. User logs in with credentials                    │
       │────────────────────────────────────────────────────►│
       │                                                      │
       │                                    2. Verify JWT    │
       │                                       Create Player │
       │◄────────────────────────────────────────────────────│
       │            roomId + sessionId                       │
       │                                                      │
       │ 3. Generate reconnectionToken                       │
       │◄────────────────────────────────────────────────────│
       │      "abc-123-xyz-token"                            │
       │                                                      │
       │ 4. Save to localStorage                             │
       │    colyseusReconnectionToken = "abc-123-xyz-token"  │
       │                                                      │
       │ 5. Game starts - playing normally                   │
       │                                                      │
```

---

## Flow 2: Accidental Disconnect (Browser Refresh)

```
┌─────────────┐                                        ┌─────────────┐
│   Browser   │                                        │   Server    │
└──────┬──────┘                                        └──────┬──────┘
       │                                                      │
       │ ❌ User presses F5 (Refresh)                        │
       │                                                      │
       │ WebSocket closes (code 1006 - abnormal)             │
       │────────────────────────────────────────────────────►│
       │                                                      │
       │                              1. onLeave(client, ❌)  │
       │                                 consented = false   │
       │                                                      │
       │                              2. Keep player in map  │
       │                                 allowReconnection() │
       │                                 300 second window   │
       │                                                      │
       │ 3. Page reloads                                     │
       │    localStorage still has token ✅                  │
       │                                                      │
       │ 4. Check for saved token                            │
       │    Found: "abc-123-xyz-token"                       │
       │                                                      │
       │ 5. Attempt reconnection with token                  │
       │────────────────────────────────────────────────────►│
       │      reconnect("abc-123-xyz-token")                 │
       │                                                      │
       │                              6. Validate token      │
       │                                 Match player        │
       │                                 Restore session     │
       │◄────────────────────────────────────────────────────│
       │         ✅ Reconnected! Same sessionId              │
       │                                                      │
       │ 7. Generate NEW token                               │
       │◄────────────────────────────────────────────────────│
       │      "xyz-456-abc-newtoken"                         │
       │                                                      │
       │ 8. Update localStorage                              │
       │    colyseusReconnectionToken = "xyz-456-abc-newtoken"│
       │                                                      │
       │ 9. State restored ✅                                │
       │    - Same gold                                      │
       │    - Same bench                                     │
       │    - Same board                                     │
       │    - Same HP                                        │
       │                                                      │
```

---

## Flow 3: Intentional Disconnect (Logout)

```
┌─────────────┐                                        ┌─────────────┐
│   Browser   │                                        │   Server    │
└──────┬──────┘                                        └──────┬──────┘
       │                                                      │
       │ 1. User clicks "Logout" button                      │
       │                                                      │
       │ 2. room.leave(consented = ✅ true)                  │
       │────────────────────────────────────────────────────►│
       │                                                      │
       │                              3. onLeave(client, ✅)  │
       │                                 consented = true    │
       │                                                      │
       │                              4. Remove player       │
       │                                 NO reconnection     │
       │                                                      │
       │ 5. Clear localStorage                               │
       │    colyseusReconnectionToken = ❌ deleted           │
       │                                                      │
       │ 6. Redirect to login                                │
       │                                                      │
```

---

## Flow 4: Reconnection Failure (Expired Token)

```
┌─────────────┐                                        ┌─────────────┐
│   Browser   │                                        │   Server    │
└──────┬──────┘                                        └──────┬──────┘
       │                                                      │
       │ 1. Server was restarted (or 5 min timeout)          │
       │    Old tokens are now invalid                       │
       │                                                      │
       │ 2. User refreshes browser                           │
       │    Token found in localStorage                      │
       │                                                      │
       │ 3. Attempt reconnection                             │
       │────────────────────────────────────────────────────►│
       │      reconnect("old-expired-token")                 │
       │                                                      │
       │                              4. Token invalid ❌    │
       │◄────────────────────────────────────────────────────│
       │         Error: Token expired                        │
       │                                                      │
       │ 5. Clear old token                                  │
       │    localStorage.remove("colyseusReconnectionToken") │
       │                                                      │
       │ 6. Join NEW game instead                            │
       │────────────────────────────────────────────────────►│
       │      joinOrCreate() with JWT                        │
       │                                                      │
       │                              7. Create NEW player   │
       │                                 NEW sessionId       │
       │◄────────────────────────────────────────────────────│
       │         Fresh game state                            │
       │                                                      │
```

---

## Flow 5: Network Error with Auto-Retry

```
┌─────────────┐                                        ┌─────────────┐
│   Browser   │                                        │   Server    │
└──────┬──────┘                                        └──────┬──────┘
       │                                                      │
       │ ⚠️ Network interruption (WiFi dropped)              │
       │                                                      │
       │ WebSocket closes (code 1006)                        │
       │────────────────────────────────────────────────────►│
       │                                                      │
       │                              1. onLeave(client, ❌)  │
       │                                 Keep player data    │
       │                                                      │
       │ 2. Detect accidental disconnect                     │
       │    Start auto-reconnect                             │
       │                                                      │
       │ 3. Wait 1 second (attempt 1/5)                      │
       │                                                      │
       │ 4. Try reconnect                                    │
       │────────────────────────────────────────────────────►│
       │      ❌ Failed (network still down)                 │
       │                                                      │
       │ 5. Wait 2 seconds (attempt 2/5)                     │
       │                                                      │
       │ 6. Try reconnect                                    │
       │────────────────────────────────────────────────────►│
       │      ❌ Failed (network still down)                 │
       │                                                      │
       │ 7. Wait 4 seconds (attempt 3/5)                     │
       │                                                      │
       │ 8. Try reconnect                                    │
       │────────────────────────────────────────────────────►│
       │      ✅ Success! Network restored                   │
       │                                                      │
       │ 9. Resume game with same state                      │
       │                                                      │
```

---

## Component Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                           CLIENT SIDE                              │
└────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│   GameLobby.tsx     │  ← User Interface
│  - Shows players    │
│  - Ready button     │
│  - Auto-connects    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   gameStore.ts      │  ← State Management (Zustand)
│  - Connection lock  │     Prevents double connections
│  - Reconnect logic  │     Handles reconnection attempts
│  - Fallback logic   │     Joins new game if reconnect fails
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   GameClient.ts     │  ← WebSocket Client
│  - Token storage    │     Save/load from localStorage
│  - Reconnect()      │     Attempt reconnection
│  - onLeave handler  │     Detect disconnect type
│  - Auto-retry       │     Exponential backoff
└──────────┬──────────┘
           │
           ▼ WebSocket

┌────────────────────────────────────────────────────────────────────┐
│                          SERVER SIDE                               │
└────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐
│  AutoChessRoom.ts   │  ← Colyseus Room
│                     │
│  onCreate()         │  ← Initialize
│   └─ setSeatReservationTime(300)  // 5 minutes
│                     │
│  onAuth()           │  ← Verify JWT
│   └─ Check duplicate users
│                     │
│  onJoin()           │  ← Player joins
│   └─ Create player state
│                     │
│  onLeave()          │  ← Player disconnects
│   ├─ If consented = true  → Remove player
│   └─ If consented = false → allowReconnection(300)
│                     │
│  allowReconnection()│  ← Promise-based
│   └─ Resolves when player reconnects
│   └─ Rejects after 300s timeout
└─────────────────────┘
```

---

## Token Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     TOKEN LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────┘

Initial Connection:
┌────────┐    Generate     ┌──────────┐    Save to     ┌──────────┐
│ Server │───────────────►│  Token   │───────────────►│localStorage│
│Colyseus│   "token-123"   │"token-123"│                │          │
└────────┘                 └──────────┘                 └──────────┘

First Reconnection:
┌────────┐    Read        ┌──────────┐    Send        ┌────────┐
│localStorage│──────────►│  Token   │───────────────►│ Server │
│          │ "token-123"  │"token-123"│                │        │
└──────────┘              └──────────┘                 └────┬───┘
                                                            │
                          ┌──────────┐    Generate         │
                          │New Token │◄────────────────────┘
                          │"token-456"│
                          └────┬─────┘
                               │
                               │ Save
                               ▼
                          ┌──────────┐
                          │localStorage│
                          │"token-456"│
                          └──────────┘

Second Reconnection:
┌────────┐    Read        ┌──────────┐    Send        ┌────────┐
│localStorage│──────────►│  Token   │───────────────►│ Server │
│          │ "token-456"  │"token-456"│                │        │
└──────────┘              └──────────┘                 └────┬───┘
                                                            │
                          ┌──────────┐    Generate         │
                          │New Token │◄────────────────────┘
                          │"token-789"│
                          └────┬─────┘
                               │
                               │ Update
                               ▼
                          ┌──────────┐
                          │localStorage│
                          │"token-789"│
                          └──────────┘

KEY POINT: Token refreshes on EVERY reconnection to prevent replay attacks
```

---

## Exponential Backoff Visualization

```
┌─────────────────────────────────────────────────────────────────┐
│                  AUTO-RECONNECT TIMELINE                        │
└─────────────────────────────────────────────────────────────────┘

Disconnect
    │
    │ ⏱️  1 second
    ├──────────► Attempt 1 ❌
    │
    │ ⏱️  2 seconds
    ├──────────────────► Attempt 2 ❌
    │
    │ ⏱️  4 seconds
    ├────────────────────────────────► Attempt 3 ❌
    │
    │ ⏱️  8 seconds
    ├────────────────────────────────────────────────────► Attempt 4 ❌
    │
    │ ⏱️  16 seconds
    ├────────────────────────────────────────────────────────────────────────────────► Attempt 5 ❌
    │
    ▼
  Give Up (Clear token, show error)

Total time before giving up: 1 + 2 + 4 + 8 + 16 = 31 seconds
```

---

## State Preservation Map

```
┌─────────────────────────────────────────────────────────────────┐
│              WHAT GETS PRESERVED ON RECONNECT                   │
└─────────────────────────────────────────────────────────────────┘

Player State:
  ✅ sessionId        (Same ID - proves it's reconnection)
  ✅ userId           (Database user ID)
  ✅ username         (Display name)
  ✅ gold             (Currency)
  ✅ hp               (Health points)
  ✅ xp               (Experience)
  ✅ level            (Player level)
  ✅ isReady          (Ready status)
  ✅ isEliminated     (Game status)

Inventory:
  ✅ bench[]          (Characters on bench)
  ✅ board[]          (Characters on board with positions)
  ✅ shopCharacterIds[] (Current shop offerings)

Game State:
  ✅ phase            (WAITING/PREPARATION/COMBAT)
  ✅ roundNumber      (Current round)
  ✅ timer            (Time remaining in phase)
  ✅ roomId           (Lobby ID)

What DOESN'T Persist:
  ❌ Server process memory (resets on server restart)
  ❌ Old reconnection tokens (become invalid)
  ❌ WebSocket connection (new connection created)
```

---

## Error Handling Decision Tree

```
                    Player Disconnects
                          │
                          ▼
              ┌───────────────────────┐
              │  Check disconnect type │
              └───────────┬───────────┘
                          │
           ┌──────────────┴──────────────┐
           │                             │
      Intentional                   Accidental
    (consented=true)              (consented=false)
           │                             │
           ▼                             ▼
    ┌─────────────┐              ┌─────────────┐
    │Remove player│              │Keep player  │
    │Clear token  │              │Open 5-min   │
    │immediately  │              │window       │
    └─────────────┘              └──────┬──────┘
                                        │
                           ┌────────────┴────────────┐
                           │                         │
                    Player reconnects          Timeout (5 min)
                      within 5 min                   │
                           │                         ▼
                           ▼                  ┌─────────────┐
                    ┌─────────────┐           │Remove player│
                    │Restore state│           │from game    │
                    │Update token │           └─────────────┘
                    │Continue game│
                    └─────────────┘
```

---

## Key Configuration Values

```
┌─────────────────────────────────────────────────────────────────┐
│                   CONFIGURATION CONSTANTS                       │
└─────────────────────────────────────────────────────────────────┘

Server (AutoChessRoom.ts):
  • Seat Reservation Time:  300 seconds (5 minutes)
  • Reconnection Window:     300 seconds (5 minutes)
  • Max Clients:             8 players

Client (GameClient.ts):
  • Max Reconnect Attempts:  5 attempts
  • Backoff Formula:         1000 * 2^(attempt - 1) milliseconds
  • Backoff Sequence:        1s, 2s, 4s, 8s, 16s
  • Total Retry Time:        31 seconds

WebSocket Close Codes:
  • 1000 = Normal close      (Intentional - logout)
  • 1001+ = Abnormal close   (Accidental - crash/refresh)

localStorage Key:
  • "colyseusReconnectionToken"
```

---

## Summary: Professional Reconnection Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SYSTEM GUARANTEES                          │
└─────────────────────────────────────────────────────────────────┘

✅ Seamless Experience
   → Players can refresh browser without losing progress

✅ Security
   → Tokens refresh on each reconnection
   → JWT authentication required

✅ Reliability
   → Automatic retry with exponential backoff
   → 5-minute grace period for reconnection

✅ State Consistency
   → All player data preserved (gold, bench, board)
   → Game phase maintained

✅ Duplicate Prevention
   → Active client check before allowing connection
   → One session per user at a time

✅ Resource Management
   → Automatic cleanup after timeout
   → Clear distinction between intentional/accidental disconnect

┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION READY ✅                          │
└─────────────────────────────────────────────────────────────────┘
```
