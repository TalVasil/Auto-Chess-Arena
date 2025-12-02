# Auto Chess Arena - Setup Instructions

## Prerequisites Installation

Before we can set up the project, you need to install these tools:

### 1. Install Node.js (Required)

**Download and Install:**
- Go to: https://nodejs.org/
- Download the **LTS version** (Long Term Support)
- Run the installer
- Check "Automatically install necessary tools" during installation

**Verify Installation:**
Open a new terminal and run:
```bash
node --version    # Should show v18.x.x or higher
npm --version     # Should show 9.x.x or higher
```

### 2. Install pnpm (Recommended - Faster than npm)

After Node.js is installed:
```bash
npm install -g pnpm
```

Verify:
```bash
pnpm --version
```

### 3. Install Docker Desktop (For Redis & PostgreSQL)

**Download and Install:**
- Go to: https://www.docker.com/products/docker-desktop/
- Download Docker Desktop for Windows
- Run the installer
- Restart your computer if prompted

**Verify Installation:**
```bash
docker --version
docker-compose --version
```

### 4. Install Git (If not already installed)

**Download and Install:**
- Go to: https://git-scm.com/download/win
- Run the installer with default settings

**Verify:**
```bash
git --version
```

---

## Project Setup (Run After Installing Prerequisites)

Once you have Node.js, pnpm, and Docker installed, run these commands:

### 1. Navigate to Project Directory
```bash
cd c:\Users\PC\.vscode\TFTal
```

### 2. Install Client Dependencies
```bash
cd client
pnpm install
cd ..
```

### 3. Install Server Dependencies
```bash
cd server
pnpm install
cd ..
```

### 4. Install Shared Package Dependencies
```bash
cd shared
pnpm install
cd ..
```

### 5. Start Docker Services (Redis + PostgreSQL)
```bash
docker-compose up -d
```

### 6. Start Development Servers

**Option A: Start Everything at Once (from root directory)**
```bash
pnpm dev
```

**Option B: Start Individually**

Terminal 1 - Client:
```bash
cd client
pnpm dev
```

Terminal 2 - Server:
```bash
cd server
pnpm dev
```

---

## Access Your Game

After starting the development servers:

- **Client (Game UI)**: http://localhost:3000
- **Server (Game Server)**: http://localhost:2567
- **Redis**: localhost:6379
- **PostgreSQL**: localhost:5432

---

## Troubleshooting

### Node.js not found
- Make sure you restart your terminal after installing Node.js
- Check if Node.js is in your system PATH

### Docker not starting
- Make sure Docker Desktop is running
- On Windows, you might need to enable WSL 2

### Port already in use
- Change ports in configuration files:
  - Client: `client/vite.config.ts` (change port 3000)
  - Server: `server/src/index.ts` (change port 2567)

### pnpm not found
- Run: `npm install -g pnpm`
- Restart your terminal

---

## Next Steps After Setup

1. The project structure is ready
2. All configuration files are in place
3. You can start developing the game!

See [TECHNICAL_README.md](./TECHNICAL_README.md) for architecture details.
See [GAME_OVERVIEW.md](./GAME_OVERVIEW.md) for game design specifications.
