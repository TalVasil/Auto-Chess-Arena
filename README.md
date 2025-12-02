# Auto Chess Arena

An 8-player real-time auto chess multiplayer game built with React, TypeScript, PixiJS, and Colyseus.

## Project Structure

```
TFTal/
├── client/                 # React + TypeScript + PixiJS frontend
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── game/          # PixiJS game logic
│   │   ├── store/         # Zustand state management
│   │   ├── network/       # Colyseus client
│   │   ├── types/         # TypeScript types
│   │   └── styles/        # CSS styles
│   ├── package.json
│   └── vite.config.ts
│
├── server/                # Colyseus + Node.js backend
│   ├── src/
│   │   ├── rooms/         # Game room logic
│   │   ├── schema/        # Game state schemas
│   │   ├── systems/       # Game systems (combat, shop, etc.)
│   │   └── db/            # Database connections
│   ├── package.json
│   └── tsconfig.json
│
├── shared/                # Shared types and constants
│   ├── src/
│   │   ├── types/         # Shared TypeScript types
│   │   └── constants/     # Game configuration
│   └── package.json
│
├── docker-compose.yml     # Redis + PostgreSQL setup
├── package.json           # Root package with scripts
└── README.md              # This file
```

## Prerequisites

Before you begin, ensure you have the following installed:

### 1. Node.js (Required)
- **Version:** 18.x or higher (LTS recommended)
- **Download:** https://nodejs.org/
- **Verify installation:**
  ```bash
  node --version  # Should show v18.x.x or higher
  npm --version   # Should show 9.x.x or higher
  ```

### 2. npm or pnpm (Package Manager)
- **npm** comes with Node.js
- **pnpm (recommended)** - faster and more efficient:
  ```bash
  npm install -g pnpm
  pnpm --version  # Verify installation
  ```

### 3. Docker Desktop (Optional but Recommended)
- **Required for:** Redis and PostgreSQL databases
- **Download:** https://www.docker.com/products/docker-desktop/
- **Verify installation:**
  ```bash
  docker --version
  docker-compose --version
  ```

## Installation

### Step 1: Clone or Navigate to Project

```bash
cd c:\\Users\\PC\\.vscode\\TFTal
```

### Step 2: Install Dependencies

**Option A: Using npm (comes with Node.js)**
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install

# Install shared package dependencies
cd ../shared
npm install

# Return to root
cd ..
```

**Option B: Using pnpm (recommended - faster)**
```bash
# Install root dependencies
pnpm install

# Install client dependencies
cd client
pnpm install

# Install server dependencies
cd ../server
pnpm install

# Install shared package dependencies
cd ../shared
pnpm install

# Return to root
cd ..
```

### Step 3: Set Up Environment Variables

**Client (.env file):**
```bash
cd client
cp .env.example .env
```

**Server (.env file):**
```bash
cd ../server
cp .env.example .env
```

### Step 4: Start Docker Services (Optional)

If you have Docker installed:

```bash
docker-compose up -d
```

This starts:
- **Redis** on `localhost:6379`
- **PostgreSQL** on `localhost:5432`

Check status:
```bash
docker-compose ps
```

## Running the Application

### Development Mode

**Start everything at once (from root directory):**
```bash
npm run dev
```

This starts:
- **Client:** http://localhost:3000
- **Server:** http://localhost:2567

**Or start individually:**

Terminal 1 - Start Server:
```bash
npm run dev:server
```

Terminal 2 - Start Client:
```bash
npm run dev:client
```

### Access the Application

- **Game Client:** http://localhost:3000
- **Server Health Check:** http://localhost:2567/health
- **Redis:** localhost:6379
- **PostgreSQL:** localhost:5432

## Available Scripts

### Root Level Scripts

```bash
# Development
npm run dev                 # Start both client and server
npm run dev:client          # Start only client
npm run dev:server          # Start only server

# Build
npm run build               # Build all packages
npm run build:client        # Build only client
npm run build:server        # Build only server
npm run build:shared        # Build shared types

# Code Quality
npm run lint                # Lint all packages
npm run format              # Format code with Prettier
npm run type-check          # TypeScript type checking

# Docker
npm run docker:up           # Start Redis + PostgreSQL
npm run docker:down         # Stop databases
npm run docker:logs         # View database logs
```

### Client Scripts

```bash
cd client
npm run dev                 # Start Vite dev server
npm run build               # Build for production
npm run preview             # Preview production build
npm run lint                # Lint client code
npm run format              # Format client code
npm run type-check          # Check TypeScript types
```

### Server Scripts

```bash
cd server
npm run dev                 # Start server with hot reload
npm run build               # Build TypeScript to JavaScript
npm run start               # Start production server
npm run lint                # Lint server code
npm run format              # Format server code
npm run type-check          # Check TypeScript types
```

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **PixiJS 8** - 2D WebGL rendering engine
- **Zustand** - State management
- **Colyseus Client** - Multiplayer client SDK

### Backend
- **Node.js** - Runtime environment
- **Colyseus** - Multiplayer game server framework
- **Express** - HTTP server
- **TypeScript** - Type safety
- **Redis** - In-memory cache for active games
- **PostgreSQL** - Persistent database

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Docker** - Containerization
- **tsx** - TypeScript execution

## Project Status

- ✅ Project infrastructure set up
- ✅ Client boilerplate created
- ✅ Server boilerplate created
- ✅ Shared types package created
- ✅ Docker configuration ready
- ✅ Development environment configured
- ⏳ Game logic implementation (next phase)
- ⏳ UI components (next phase)
- ⏳ Multiplayer synchronization (next phase)

## Troubleshooting

### Node.js Not Found

If you get `node: command not found`:
1. Restart your terminal/VS Code after installing Node.js
2. Verify Node.js is in PATH: `echo $PATH` (Linux/Mac) or `echo %PATH%` (Windows)
3. Reinstall Node.js if necessary

### Port Already in Use

If port 3000 or 2567 is already in use:

**Change client port:**
Edit `client/vite.config.ts`:
```typescript
server: {
  port: 3001, // Change this
}
```

**Change server port:**
Edit `server/.env`:
```
PORT=2568  # Change this
```

### Docker Not Starting

1. Make sure Docker Desktop is running
2. Check Docker status: `docker ps`
3. View logs: `docker-compose logs`
4. Restart Docker: `docker-compose down && docker-compose up -d`

### TypeScript Errors

```bash
# Clean build and reinstall
rm -rf node_modules package-lock.json
npm install

# Or with pnpm
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Next Steps

1. ✅ **Setup Complete** - You've installed everything!
2. 📝 **Read Documentation:**
   - [GAME_OVERVIEW.md](./GAME_OVERVIEW.md) - Game design specification
   - [TECHNICAL_README.md](./TECHNICAL_README.md) - Technical architecture
3. 🎮 **Start Development:**
   - Implement game components
   - Add PixiJS rendering
   - Build multiplayer features

## Resources

- [Colyseus Documentation](https://docs.colyseus.io/)
- [PixiJS Documentation](https://pixijs.com/guides)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

## License

MIT

## Support

For issues or questions, create an issue in the project repository.

---

**Happy Coding!** 🎮🚀
