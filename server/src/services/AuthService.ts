import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '15m'; // Short-lived access token (15 minutes)

export interface JWTPayload {
  userId: number;
  username: string;
  displayName: string;
}

export class AuthService {
  /**
   * Generate JWT access token
   * @param userId - User ID
   * @param username - Username (for login)
   * @param displayName - Display name (shown in game)
   * @returns JWT token string
   */
  static generateAccessToken(userId: number, username: string, displayName: string): string {
    const payload: JWTPayload = {
      userId,
      username,
      displayName,
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });
  }

  /**
   * Verify and decode JWT access token
   * @param token - JWT token to verify
   * @returns Decoded payload
   * @throws Error if token is invalid or expired
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Generate random refresh token for "Remember Me"
   * @returns Random 64-byte hex string
   */
  static generateRefreshToken(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  /**
   * Calculate token expiration date
   * @param days - Number of days until expiration (default 30)
   * @returns Date object
   */
  static getRefreshTokenExpiration(days: number = 30): Date {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + days);
    return expirationDate;
  }
}
