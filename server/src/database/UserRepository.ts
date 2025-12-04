import { query } from './db.js';

export interface User {
  id: number;
  username: string;
  password: string;
  email: string;
  display_name: string;
  created_at: Date;
  last_login_at: Date;
}

export interface RefreshToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export class UserRepository {
  /**
   * Register a new user
   * Validates username, password, and email uniqueness
   */
  async registerUser(
    username: string,
    password: string,
    email: string,
    displayName: string
  ): Promise<User> {
    // Validate username length (3-20 characters)
    if (username.length < 3 || username.length > 20) {
      throw new Error('Username must be between 3 and 20 characters');
    }

    // Validate password length (8-20 characters)
    if (password.length < 8 || password.length > 20) {
      throw new Error('Password must be between 8 and 20 characters');
    }

    // Check if username already exists
    const usernameExists = await this.checkUsernameExists(username);
    if (usernameExists) {
      throw new Error('Username already taken');
    }


    // Check if password is already used (unique password requirement)
    const passwordExists = await this.checkPasswordExists(password);
    if (passwordExists) {
      throw new Error('This password is already in use. Please choose a different password');
    }

    // Insert new user
    const result = await query(
      `INSERT INTO users (username, password, email, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [username, password, email, displayName]
    );

    const user = result.rows[0];

    console.log(`🆕 New user registered: ${username} (ID: ${user.id})`);
    return user;
  }

  /**
   * Login user with username and password
   */
  async loginUser(username: string, password: string): Promise<User> {
    const result = await query(
      `SELECT * FROM users WHERE username = $1 AND password = $2`,
      [username, password]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid username or password');
    }

    const user = result.rows[0];

    // Update last login time
    await this.updateLastLogin(user.id);

    console.log(`✅ User logged in: ${username} (ID: ${user.id})`);
    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(id: number): Promise<User | null> {
    const result = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get user by username
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const result = await query(`SELECT * FROM users WHERE username = $1`, [username]);
    return result.rows[0] || null;
  }

  /**
   * Get user by email (for password recovery)
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const result = await query(`SELECT * FROM users WHERE email = $1`, [email]);
    return result.rows[0] || null;
  }

  /**
   * Check if username exists
   */
  async checkUsernameExists(username: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM users WHERE username = $1 LIMIT 1`,
      [username]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if email exists
   */
  async checkEmailExists(email: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );
    return result.rows.length > 0;
  }

  /**
   * Check if password is already used by another user
   * (Unique password requirement)
   */
  async checkPasswordExists(password: string): Promise<boolean> {
    const result = await query(
      `SELECT 1 FROM users WHERE password = $1 LIMIT 1`,
      [password]
    );
    return result.rows.length > 0;
  }

  /**
   * Update last login timestamp
   */
  async updateLastLogin(userId: number): Promise<void> {
    await query(
      `UPDATE users SET last_login_at = NOW() WHERE id = $1`,
      [userId]
    );
  }

  /**
   * Create a refresh token for "Remember Me" functionality
   */
  async createRefreshToken(userId: number, token: string, expiresAt: Date): Promise<RefreshToken> {
    const result = await query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [userId, token, expiresAt]
    );
    return result.rows[0];
  }

  /**
   * Validate and get user from refresh token
   */
  async validateRefreshToken(token: string): Promise<User | null> {
    const result = await query(
      `SELECT u.* FROM users u
       JOIN refresh_tokens rt ON u.id = rt.user_id
       WHERE rt.token = $1 AND rt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0];

    // Update last login
    await this.updateLastLogin(user.id);

    return user;
  }

  /**
   * Delete refresh token (logout)
   */
  async deleteRefreshToken(token: string): Promise<void> {
    await query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
  }

  /**
   * Clean up expired refresh tokens
   */
  async cleanupExpiredTokens(): Promise<void> {
    const result = await query(`DELETE FROM refresh_tokens WHERE expires_at < NOW()`);
    if (result.rowCount && result.rowCount > 0) {
      console.log(`🧹 Cleaned up ${result.rowCount} expired refresh tokens`);
    }
  }
}

// Export singleton instance
export const userRepository = new UserRepository();
