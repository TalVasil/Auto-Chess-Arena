# Quick Start Guide

## If You Have Node.js and npm Already Installed

### 1. Open Terminal in Project Directory

Press `Ctrl + `` (backtick) in VS Code to open the integrated terminal, or:

```bash
cd c:\\Users\\PC\\.vscode\\TFTal
```

### 2. Install All Dependencies (One Command!)

```bash
npm install && cd client && npm install && cd ../server && npm install && cd ../shared && npm install && cd ..
```

This installs dependencies for:
- ✅ Root project
- ✅ Client (React + PixiJS)
- ✅ Server (Colyseus)
- ✅ Shared types

**Wait time:** 2-5 minutes depending on internet speed

### 3. Start the Development Servers

```bash
npm run dev
```

This automatically starts:
- 🎨 **Client** on http://localhost:3000
- 🎮 **Server** on http://localhost:2567

### 4. Open Your Browser

Navigate to: **http://localhost:3000**

You should see the "Auto Chess Arena" welcome screen!

---

## If Node.js Is Not Installed

### Step 1: Install Node.js

1. Go to: **https://nodejs.org/**
2. Download the **LTS version** (green button)
3. Run the installer
4. ✅ Check "Automatically install necessary tools"
5. Complete installation
6. **Restart your computer**

### Step 2: Verify Installation

Open a **new terminal** and run:

```bash
node --version
npm --version
```

You should see version numbers like:
```
v20.11.0
10.2.4
```

### Step 3: Return to Installation (Above)

Go back to "If You Have Node.js Already Installed" section above.

---

## Optional: Install Docker (For Databases)

### Why Docker?

Docker provides Redis and PostgreSQL databases for:
- Player matchmaking queues
- Active game sessions
- Player accounts and match history

### How to Install

1. Download: **https://www.docker.com/products/docker-desktop/**
2. Install with default settings
3. Start Docker Desktop
4. In terminal, run:
   ```bash
   docker-compose up -d
   ```

### Verify Docker Is Running

```bash
docker ps
```

You should see `autochess-redis` and `autochess-postgres` containers running.

---

## Common Issues

### "npm: command not found"

**Solution:** Restart your terminal or VS Code after installing Node.js

### "Port 3000 is already in use"

**Solution:** Kill the process using port 3000:

**Windows:**
```bash
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F
```

**Mac/Linux:**
```bash
lsof -ti:3000 | xargs kill
```

### TypeScript errors during install

**Solution:** This is normal during first install. They'll resolve after all packages are installed.

---

## What's Next?

After setup is complete:

1. ✅ **Explore the codebase:**
   - `client/src/` - React frontend
   - `server/src/` - Colyseus game server
   - `shared/src/` - Shared types

2. 📖 **Read the documentation:**
   - [GAME_OVERVIEW.md](./GAME_OVERVIEW.md) - Game design
   - [TECHNICAL_README.md](./TECHNICAL_README.md) - Architecture
   - [README.md](./README.md) - Full documentation

3. 🎮 **Start developing:**
   - Build game components
   - Implement game logic
   - Add multiplayer features

---

## Quick Commands Reference

```bash
# Start development
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Format code
npm run format

# Start Docker databases
docker-compose up -d

# Stop Docker databases
docker-compose down
```

---

**You're all set! Happy coding!** 🚀
