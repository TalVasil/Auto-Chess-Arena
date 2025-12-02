import { Schema, type } from '@colyseus/schema';

export class UserStats extends Schema {
  @type('string') userId: string = '';
  @type('string') username: string = '';
  @type('number') gamesPlayed: number = 0;
  @type('number') wins: number = 0;
  @type('number') losses: number = 0;
  @type('number') createdAt: number = Date.now();
  @type('number') lastLoginAt: number = Date.now();
}

// In-memory user store (in production, use a real database)
export class UserStore {
  private users: Map<string, UserStats> = new Map();
  private usernameToId: Map<string, string> = new Map();

  // Register or login a user
  registerOrLogin(username: string): UserStats {
    // Check if username exists
    const existingId = this.usernameToId.get(username);

    if (existingId) {
      // User exists, update last login
      const user = this.users.get(existingId)!;
      user.lastLoginAt = Date.now();
      console.log(`✅ User "${username}" logged in (ID: ${existingId})`);
      return user;
    }

    // Create new user
    const userId = this.generateUserId();
    const newUser = new UserStats();
    newUser.userId = userId;
    newUser.username = username;
    newUser.gamesPlayed = 0;
    newUser.wins = 0;
    newUser.losses = 0;
    newUser.createdAt = Date.now();
    newUser.lastLoginAt = Date.now();

    this.users.set(userId, newUser);
    this.usernameToId.set(username, userId);

    console.log(`🆕 New user registered: "${username}" (ID: ${userId})`);
    return newUser;
  }

  // Get user by ID
  getUserById(userId: string): UserStats | undefined {
    return this.users.get(userId);
  }

  // Get user by username
  getUserByUsername(username: string): UserStats | undefined {
    const userId = this.usernameToId.get(username);
    return userId ? this.users.get(userId) : undefined;
  }

  // Update user stats after game
  updateUserStats(userId: string, won: boolean) {
    const user = this.users.get(userId);
    if (!user) return;

    user.gamesPlayed++;
    if (won) {
      user.wins++;
    } else {
      user.losses++;
    }

    console.log(`📊 Updated stats for ${user.username}: ${user.wins}W/${user.losses}L (${user.gamesPlayed} games)`);
  }

  // Generate unique user ID
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // Check if username is taken
  isUsernameTaken(username: string): boolean {
    return this.usernameToId.has(username);
  }
}

// Global user store instance
export const globalUserStore = new UserStore();
