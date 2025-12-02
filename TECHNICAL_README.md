# Auto Chess Arena - Technical Documentation

## Technology Stack

### Architecture Overview

```
┌─────────────────────────────────────────┐
│           CLIENT (Browser)               │
├─────────────────────────────────────────┤
│  React 18 + TypeScript                  │
│  ├─ UI Components (Zustand)             │
│  ├─ PixiJS Renderer (Game View)         │
│  └─ Colyseus Client SDK                 │
└──────────────────┬──────────────────────┘
                   │ WebSocket
                   │
┌──────────────────▼──────────────────────┐
│      GAME SERVER (Node.js)              │
├─────────────────────────────────────────┤
│  Colyseus Framework                     │
│  ├─ Room Management (8-player lobbies)  │
│  ├─ Game State Authority                │
│  ├─ Combat Simulation Engine            │
│  └─ Matchmaking Logic                   │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌────────▼──────────┐
│ Redis          │   │ PostgreSQL        │
├────────────────┤   ├───────────────────┤
│ Active Games   │   │ User Accounts     │
│ Player Queues  │   │ Match History     │
│ Live Sessions  │   │ Player Stats      │
└────────────────┘   │ Character Defs    │
                     └───────────────────┘
```

---

## Core Technologies

### 1. Frontend - Game Rendering Engine

#### **PixiJS v8** (Primary Choice)

**Purpose**: 2D WebGL rendering engine for game graphics

**Why PixiJS:**
- Fastest 2D WebGL renderer available with sub-millisecond performance
- Optimized for sprite-based games with many entities on screen
- Lightweight bundle size (~150KB minified)
- Excellent for tile-based grids (8×9 arena, 10-tile bench)
- Built-in sprite batching for efficient rendering of multiple characters
- Mature ecosystem with extensive documentation

**Use Cases in Our Game:**
- Rendering the 8×9 arena grid
- Character sprites and animations
- Combat visual effects
- Drag-and-drop interactions for character placement

**Installation:**
```bash
npm install pixi.js
```

**Alternative Options:**

| Technology | Pros | Cons | Use Case |
|------------|------|------|----------|
| **Phaser 3/4** | Full game framework, built-in physics, scene management, game loop | 2x larger bundle, more features than needed | Choose if you need built-in physics or prefer all-in-one framework |
| **Three.js** | Powerful for 3D, good 2D sprite support | Overkill for pure 2D, larger overhead | Choose if planning 3D environments or effects |
| **React Three Fiber** | Declarative 3D/2D, React integration | React overhead, less performant for 2D | Choose if team strongly prefers React-first approach |

---

### 2. Frontend - UI Framework

#### **React 18+ with TypeScript** (Primary Choice)

**Purpose**: Component-based UI framework for game interface

**Why React + TypeScript:**
- Component-based architecture perfect for complex game UI (store, bench, arena, scoreboard, sidebar)
- TypeScript provides type safety for game state, character definitions, and API contracts
- Massive ecosystem and developer familiarity reduces onboarding time
- Easy integration with PixiJS via refs and useEffect hooks
- Concurrent rendering in React 18 improves performance
- Clear separation: React handles UI elements (buttons, HP bars, timers) while PixiJS handles game rendering

**Use Cases in Our Game:**
- Shop UI (character cards, buy buttons, reroll/XP buttons)
- Scoreboard (live HP tracking for 8 players)
- Combat bonuses sidebar
- Timer display
- Player stats (gold, XP, level)
- Game phase indicators

**Installation:**
```bash
npm create vite@latest game-client -- --template react-ts
```

**Alternative Options:**

| Technology | Pros | Cons | Use Case |
|------------|------|------|----------|
| **Vue 3** | Lighter weight, simpler learning curve, excellent performance | Smaller ecosystem for game dev | Choose if team prefers Vue's template syntax |
| **Svelte** | Best performance, smallest bundle, reactive by default | Smaller community, fewer game resources | Choose if minimizing bundle size is critical |
| **Vanilla JS** | Maximum performance, zero framework overhead | Much more code, harder to maintain complex UI | Choose only for extreme performance requirements |

---

### 3. Backend - Multiplayer Server Framework

#### **Colyseus** (Primary Choice)

**Purpose**: Authoritative multiplayer game server framework

**Why Colyseus:**
- **Purpose-built for multiplayer games** - not a general WebSocket library
- **Authoritative server architecture** - prevents client-side cheating
- **Automatic state synchronization** using binary delta patches (only transmits changes)
- **Built-in room-based matchmaking** - perfect for 8-player lobby system
- **Schema-based state definition** - type-safe state shared between client/server
- **Reconnection handling** - players can rejoin if disconnected
- **Player state persistence** during reconnection
- **TypeScript-first** - shared type definitions between client and server
- **Performance optimized** - handles thousands of concurrent users

**Use Cases in Our Game:**
- Managing 8-player game rooms
- Synchronizing game state (arena positions, player stats, combat results)
- Authoritative combat simulation (server-side)
- Matchmaking players for combat rounds
- Handling player connections/disconnections
- Preventing cheating (all game logic runs on server)

**Installation:**
```bash
npm create colyseus-app@latest ./game-server
cd game-server
npm install
```

**Core Concepts:**
```typescript
// Server-side Room definition
import { Room, Client } from "colyseus";
import { GameState } from "./schema/GameState";

export class AutoChessRoom extends Room<GameState> {
  maxClients = 8;

  onCreate(options: any) {
    this.setState(new GameState());
    // Initialize game logic
  }

  onJoin(client: Client, options: any) {
    // Player joins room
  }

  onMessage(client: Client, message: any) {
    // Handle player actions (buy character, move character, etc.)
  }

  onLeave(client: Client, consented: boolean) {
    // Handle player disconnect
  }
}
```

**Alternative Options:**

| Technology | Pros | Cons | Use Case |
|------------|------|------|----------|
| **Socket.io + Custom Logic** | Full control, well-documented, flexible, large community | Must build matchmaking, state sync, room management, and anti-cheat from scratch | Choose if you need very specific networking behavior or have experienced game server developers |
| **Nakama** | Enterprise-grade, built-in leaderboards, authentication, social features | Heavier, written in Go (different language), steeper learning curve, more complex | Choose for MMO-scale games or if you need extensive social features |
| **Phoenix Framework (Elixir)** | Legendary scalability, built-in presence tracking, channels | Different language (Elixir), steep learning curve, overkill for 8-player games | Choose only if team has Elixir expertise or needs 1000+ concurrent players |

---

### 4. State Management

#### **Zustand + Colyseus Schema** (Primary Choice)

**Purpose**: Client-side UI state and server-authoritative game state

**Why This Combination:**

**Zustand** (Client-side UI state):
- Lightweight (3KB) React state management
- Simple API - no boilerplate
- No prop drilling
- Perfect for UI-only state (menu open/closed, selected character, tooltips)
- TypeScript-friendly

**Colyseus Schema** (Server-authoritative game state):
- Server controls game state (prevents cheating)
- Automatic synchronization to all clients
- Binary delta encoding (minimal bandwidth)
- Type-safe state definitions
- Handles arena state, player stats, combat results

**Clear Separation:**
```typescript
// CLIENT UI STATE (Zustand)
interface UIState {
  selectedCharacter: string | null;
  isShopOpen: boolean;
  hoveredTile: { x: number; y: number } | null;
}

// GAME STATE (Colyseus Schema - Server Authoritative)
class GameState extends Schema {
  @type("number") phase: GamePhase;
  @type([Player]) players: Player[];
  @type("number") roundNumber: number;
  @type("number") timer: number;
}
```

**Installation:**
```bash
npm install zustand
```

**Alternative Options:**

| Technology | Pros | Cons | Use Case |
|------------|------|------|----------|
| **Redux Toolkit** | Most popular, excellent DevTools, time-travel debugging, large ecosystem | Verbose boilerplate, more complex setup, overkill for this use case | Choose if team already experienced with Redux or needs advanced debugging |
| **Recoil** | Atomic state management, excellent for derived state, good performance | Smaller community, still experimental, Meta-specific | Choose if you have complex state dependencies and derived computations |
| **Jotai** | Minimal API, atomic state, lightweight | Less mature than Zustand, smaller ecosystem | Choose if you prefer atom-based state over stores |

---

### 5. Database Layer

#### **Redis + PostgreSQL Hybrid** (Primary Choice)

**Purpose**: Fast in-memory storage for active games + persistent storage for player data

**Why Hybrid Approach:**

**Redis** (Real-time game data):
- **Sub-millisecond response times** for live game state
- **In-memory storage** for active game sessions
- **Pub/Sub messaging** for cross-server communication
- **Automatic expiration (TTL)** for temporary game data
- **Perfect for:**
  - Active game sessions (while game is running)
  - Player matchmaking queues
  - Real-time leaderboards
  - Player presence tracking
  - Session tokens

**PostgreSQL** (Persistent player data):
- **ACID compliance** for critical data integrity
- **Rich querying** for leaderboards and analytics
- **JSON support** for flexible character/item definitions
- **Mature ecosystem** with excellent tooling
- **Perfect for:**
  - Player accounts and authentication
  - Match history and statistics
  - Character definitions and balance data
  - Player rankings and achievements
  - Audit logs

**Data Flow:**
```
1. Game starts → Store in Redis
2. Game active → Update Redis state
3. Game ends → Save results to PostgreSQL
4. Redis TTL expires → Data cleaned up automatically
5. Historical queries → Read from PostgreSQL
```

**Installation:**
```bash
# Redis
npm install redis ioredis

# PostgreSQL
npm install pg
npm install @prisma/client  # ORM (recommended)
```

**Alternative Options:**

| Technology | Pros | Cons | Use Case |
|------------|------|------|----------|
| **MongoDB** | Flexible schema, good for rapid prototyping, JSON-native | Weaker consistency guarantees, not ideal for transactional data | Choose if you need highly flexible schemas or already have MongoDB expertise |
| **Redis Only** | Simplest architecture, fastest performance, single database | Data volatility (requires Redis persistence), expensive for large datasets, no complex queries | Choose only for prototype/MVP with minimal persistent data |
| **PostgreSQL Only** | Single database to manage, simpler architecture, good performance | Slower for real-time game state, requires careful optimization, more load on single DB | Choose if team size is small and you want minimal complexity |

---

### 6. Build Tools & Development

#### **Vite** (Primary Choice)

**Purpose**: Fast build tool and development server

**Why Vite:**
- **Lightning-fast Hot Module Replacement (HMR)** - instant feedback during development
- **Native ESM support** - faster cold starts than Webpack (10-100x faster)
- **Built-in TypeScript support** - zero configuration needed
- **Optimized production builds** with Rollup - tree-shaking and code splitting
- **Perfect for game development** - rapid iteration speed is critical
- **Framework agnostic** - works with React, Vue, Svelte, Vanilla JS
- **Plugin ecosystem** - extensive plugins for various needs

**Installation:**
```bash
npm create vite@latest game-client -- --template react-ts
```

**Configuration Example:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:2567', // Colyseus server
    },
  },
  build: {
    target: 'esnext',
    minify: 'terser',
  },
});
```

**Alternative Options:**

| Technology | Pros | Cons | Use Case |
|------------|------|------|----------|
| **Webpack** | Most mature, extensive plugin ecosystem, very configurable | Slower build times (10-100x slower), complex configuration, slower HMR | Choose if you need very specific build customization or legacy browser support |
| **Parcel** | Zero-config, simple setup, automatic optimization | Less control, smaller community, fewer plugins | Choose for small projects where you want absolute minimal configuration |
| **esbuild** | Fastest build speeds (Go-based), minimal configuration | Less mature plugin ecosystem, fewer features | Choose if build speed is the absolute top priority and you don't need complex plugins |

---

## Additional Essential Tools

### Development & Quality

| Tool | Purpose | Why | Installation |
|------|---------|-----|--------------|
| **Docker** | Containerization | Consistent dev/prod environments, easy Redis/PostgreSQL setup, simplified deployment | `docker.com` |
| **pnpm** | Package manager | 3x faster than npm, disk space efficient, strict dependency resolution | `npm install -g pnpm` |
| **ESLint** | Linting | Catch errors early, enforce code standards | `npm install -D eslint` |
| **Prettier** | Code formatting | Consistent code style, eliminate formatting debates | `npm install -D prettier` |
| **Husky** | Git hooks | Run linting/tests before commits | `npm install -D husky` |

### Testing

| Tool | Purpose | Why | Installation |
|------|---------|-----|--------------|
| **Jest** | Unit testing | Test game logic, state management, utilities | `npm install -D jest` |
| **React Testing Library** | Component testing | Test React components and interactions | `npm install -D @testing-library/react` |
| **Playwright** | E2E testing | Full game flow testing, multiplayer scenarios | `npm install -D @playwright/test` |

### CI/CD & Deployment

| Tool | Purpose | Why | Installation |
|------|---------|-----|--------------|
| **GitHub Actions** | CI/CD | Automated testing, building, deployment | Built into GitHub |
| **Vercel/Netlify** | Frontend hosting | Easy React deployment, CDN, HTTPS | CLI or web interface |
| **Railway/Render** | Backend hosting | Easy Node.js + Redis + PostgreSQL deployment | CLI or web interface |

---

## Project Structure

```
auto-chess-arena/
├── client/                          # Frontend (React + PixiJS)
│   ├── src/
│   │   ├── components/
│   │   │   ├── Arena/              # 8x9 grid component
│   │   │   ├── Bench/              # 10-tile bench
│   │   │   ├── Shop/               # Character shop UI
│   │   │   ├── Scoreboard/         # 8-player HP display
│   │   │   └── Sidebar/            # Combat bonuses
│   │   ├── game/
│   │   │   ├── PixiApp.ts          # PixiJS initialization
│   │   │   ├── renderer/           # Sprite rendering
│   │   │   └── interactions/       # Drag & drop logic
│   │   ├── store/
│   │   │   └── uiStore.ts          # Zustand UI state
│   │   ├── network/
│   │   │   └── ColyseusClient.ts   # Multiplayer client
│   │   ├── types/
│   │   │   └── game.types.ts       # Shared TypeScript types
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── server/                          # Backend (Colyseus)
│   ├── src/
│   │   ├── rooms/
│   │   │   └── AutoChessRoom.ts    # Game room logic
│   │   ├── schema/
│   │   │   ├── GameState.ts        # Game state schema
│   │   │   ├── Player.ts           # Player state
│   │   │   └── Character.ts        # Character data
│   │   ├── systems/
│   │   │   ├── combat.ts           # Combat simulation
│   │   │   ├── shop.ts             # Shop logic
│   │   │   └── matchmaking.ts      # Player pairing
│   │   ├── db/
│   │   │   ├── redis.ts            # Redis connection
│   │   │   └── postgres.ts         # PostgreSQL connection
│   │   └── index.ts                # Server entry point
│   └── package.json
│
├── shared/                          # Shared types & constants
│   ├── types/
│   │   ├── character.types.ts
│   │   ├── game.types.ts
│   │   └── player.types.ts
│   └── constants/
│       ├── gameConfig.ts
│       └── characterData.ts
│
├── docker-compose.yml               # Local dev environment
├── .github/
│   └── workflows/
│       └── ci.yml                   # GitHub Actions CI
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- pnpm (or npm/yarn)  
- Docker (for Redis/PostgreSQL)
- Git

### Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd auto-chess-arena

# Start databases (Docker)
docker-compose up -d

# Install dependencies
pnpm install

# Start development servers
pnpm dev:server    # Colyseus server on :2567
pnpm dev:client    # Vite dev server on :3000

# Open browser
open http://localhost:3000
```

### Development Workflow

```bash
# Run tests
pnpm test

# Lint code
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build

# Type check
pnpm type-check
```

---

## Architecture Decisions

### Why Authoritative Server?

**Problem**: Browser-based games are vulnerable to cheating (memory editors, packet manipulation)

**Solution**: Server validates all actions and simulates combat

**Benefits**:
- Players cannot cheat by modifying local game state
- Fair gameplay for all participants
- Consistent game state across all clients
- Server determines combat outcomes (cannot be manipulated)

### Why Binary State Synchronization?

**Problem**: Sending full game state every frame wastes bandwidth

**Solution**: Colyseus sends only state changes (deltas) in binary format

**Benefits**:
- Minimal bandwidth usage (critical for 8-player real-time game)
- Faster updates (binary is smaller than JSON)
- Scales better with more players

### Why Hybrid Database?

**Problem**: Single database either too slow (PostgreSQL) or too volatile (Redis)

**Solution**: Use Redis for live data, PostgreSQL for persistent data

**Benefits**:
- Fast game state updates during matches (Redis)
- Reliable player data storage (PostgreSQL)
- Automatic cleanup of expired games (Redis TTL)
- Cost-effective (Redis only stores active games)

### Why PixiJS Over Pure Canvas or WebGL?

**Problem**: Raw Canvas/WebGL requires extensive boilerplate

**Solution**: PixiJS provides high-level API with WebGL performance

**Benefits**:
- WebGL acceleration for smooth 60 FPS
- Simple API for sprites, textures, interactions
- Built-in scene graph and rendering optimizations
- Extensive plugin ecosystem

---

## Performance Targets

| Metric | Target | Reasoning |
|--------|--------|-----------|
| **Frame Rate** | 60 FPS | Smooth animations and drag interactions |
| **Client Bundle Size** | < 500 KB | Fast initial load (< 2s on 4G) |
| **Server Tick Rate** | 20 Hz (50ms) | Balance between accuracy and performance |
| **State Update Latency** | < 100ms | Responsive character placement |
| **Combat Simulation** | Real-time | Players watch combat as it happens |
| **Max Players per Server** | 100+ concurrent games | Cost-effective scaling |

---

## Security Considerations

### Anti-Cheat Measures

1. **Server-Authoritative State**: All game logic runs on server
2. **Input Validation**: Server validates every player action
3. **Rate Limiting**: Prevent spam actions (buy/reroll/move)
4. **Combat Simulation**: Server calculates all damage/outcomes
5. **Character Pool Integrity**: Server controls shop randomization

### Data Protection

1. **HTTPS Only**: All WebSocket connections over TLS
2. **Authentication**: JWT tokens for player sessions
3. **Input Sanitization**: Prevent injection attacks
4. **Rate Limiting**: Protect against DDoS
5. **Database Access Control**: Principle of least privilege

---

## Scalability Strategy

### Horizontal Scaling

```
                    ┌─── Game Server 1 (1000 players)
Load Balancer ──────┼─── Game Server 2 (1000 players)
                    └─── Game Server 3 (1000 players)
                              │
                              ├─── Redis Cluster (shared state)
                              └─── PostgreSQL (shared persistent data)
```

### Room Distribution

- Each game server handles multiple 8-player rooms
- 1 server core can handle ~50 concurrent games (400 players)
- Redis coordinates room discovery across servers
- Players can join any server with available rooms

### Database Scaling

- **Redis**: Clustered for high availability
- **PostgreSQL**: Read replicas for analytics queries
- **CDN**: Static assets (character images, sprites)

---

## Monitoring & Observability

### Key Metrics to Track

| Metric | Tool | Alert Threshold |
|--------|------|-----------------|
| Server CPU/Memory | Node.js metrics | > 80% |
| WebSocket connections | Colyseus stats | Connection drops |
| Database latency | Redis/PostgreSQL monitoring | > 50ms |
| Client FPS | Browser performance API | < 30 FPS |
| Error rate | Application logs | > 1% |
| Player churn | Analytics | > 30% early exit |

### Recommended Tools

- **Application Monitoring**: New Relic, DataDog, or self-hosted Grafana
- **Error Tracking**: Sentry
- **Analytics**: Mixpanel, Amplitude
- **Logs**: Winston (Node.js) + ELK Stack or CloudWatch

---

## References & Resources

### Official Documentation
- [Colyseus Documentation](https://docs.colyseus.io/)
- [PixiJS Documentation](https://pixijs.com/guides)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Redis Documentation](https://redis.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Research Sources
- [Creature Chess - Open Source Auto Chess](https://github.com/Jameskmonger/creature-chess)
- [PixiJS vs Phaser Performance Comparison](https://github.com/Shirajuki/js-game-rendering-benchmark)
- [Building Real-Time Multiplayer with Redis](https://dev.to/dowerdev/building-a-real-time-multiplayer-game-server-with-socketio-and-redis-architecture-and-583m)
- [Redis for Multiplayer Games](https://redis.io/blog/how-to-build-a-real-time-geo-distributed-multiplayer-top-down-arcade-shooting-game-using-redis/)
- [Multiplayer Game Architecture Best Practices](https://colyseus.io/)

### Community & Support
- Colyseus Discord: [discord.gg/RY8rRS7](https://discord.gg/RY8rRS7)
- PixiJS Discord: Community forums
- Stack Overflow: `[colyseus]`, `[pixi.js]`, `[react]` tags

---

## Next Steps

1. **Phase 1**: Project setup and environment configuration
2. **Phase 2**: Implement core game loop (single-player mode)
3. **Phase 3**: Add Colyseus multiplayer networking
4. **Phase 4**: Implement combat system and character abilities
5. **Phase 5**: UI/UX polish and visual effects
6. **Phase 6**: Testing, balancing, and optimization
7. **Phase 7**: Deployment and monitoring

See [GAME_OVERVIEW.md](./GAME_OVERVIEW.md) for complete game design specification.
