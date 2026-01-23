import { Router } from 'express';
import { userRepository } from '../database/UserRepository.js';
import { emailService } from '../services/EmailService.js';
import { AuthService } from '../services/AuthService.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, displayName } = req.body;

    // Validate required fields
    if (!username || !password || !email || !displayName) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
      });
    }

    // Register user (validation happens in repository)
    const user = await userRepository.registerUser(username, password, email, displayName);

    // Generate JWT access token
    const token = AuthService.generateAccessToken(user.id, user.username, user.display_name);

    // Send welcome email (optional, non-blocking)
    emailService.sendWelcomeEmail(email, username, displayName).catch((err) => {
      console.error('Failed to send welcome email:', err);
    });

    res.json({
      success: true,
      token,
      user: {
        userId: user.id,
        username: user.username,
        displayName: user.display_name,
        canEdit: user.can_edit || false,
      },
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Registration failed',
    });
  }
});

/**
 * POST /api/auth/login
 * Login with username and password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required',
      });
    }

    // Login user
    const user = await userRepository.loginUser(username, password);

    // Generate JWT access token
    const token = AuthService.generateAccessToken(user.id, user.username, user.display_name);

    let refreshToken = null;

    // If "Remember Me" is checked, create a refresh token
    if (rememberMe) {
      refreshToken = AuthService.generateRefreshToken();
      const expiresAt = AuthService.getRefreshTokenExpiration(30); // 30 days

      await userRepository.createRefreshToken(user.id, refreshToken, expiresAt);
    }

    res.json({
      success: true,
      token,
      refreshToken,
      user: {
        userId: user.id,
        username: user.username,
        displayName: user.display_name,
        canEdit: user.can_edit || false,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({
      success: false,
      error: error.message || 'Login failed',
    });
  }
});

/**
 * POST /api/auth/verify-token
 * Verify a remember token and auto-login
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required',
      });
    }

    // Validate refresh token
    const user = await userRepository.validateRefreshToken(token);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
    }

    // Generate new JWT access token
    const accessToken = AuthService.generateAccessToken(user.id, user.username, user.display_name);

    res.json({
      success: true,
      token: accessToken,
      user: {
        userId: user.id,
        username: user.username,
        displayName: user.display_name,
        canEdit: user.can_edit || false,
      },
    });
  } catch (error: any) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      error: 'Token verification failed',
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and delete remember token
 */
router.post('/logout', async (req, res) => {
  try {
    const { token } = req.body;

    if (token) {
      await userRepository.deleteRefreshToken(token);
    }

    res.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed',
    });
  }
});

/**
 * POST /api/auth/forgot-password
 * Send password recovery email
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    // Get user by email
    const user = await userRepository.getUserByEmail(email);

    if (!user) {
      // For security, don't reveal if email exists or not
      // Return success even if email doesn't exist (prevents email enumeration)
      return res.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password recovery email',
      });
    }

    // Send password recovery email with plain text password
    await emailService.sendPasswordRecoveryEmail(email, user.username, user.password);

    res.json({
      success: true,
      message: 'Password sent to your email',
    });
  } catch (error: any) {
    console.error('Password recovery error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send recovery email',
    });
  }
});

/**
 * GET /api/auth/check-username/:username
 * Check if username is available
 */
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;

    const exists = await userRepository.checkUsernameExists(username);

    res.json({
      success: true,
      available: !exists,
    });
  } catch (error: any) {
    console.error('Username check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check username',
    });
  }
});

/**
 * GET /api/auth/check-email/:email
 * Check if email is available (always returns true for testing)
 */
router.get('/check-email/:email', async (req, res) => {
  try {
    // Email doesn't need to be unique for testing
    res.json({
      success: true,
      available: true,
    });
  } catch (error: any) {
    console.error('Email check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check email',
    });
  }
});

/**
 * POST /api/auth/check-password
 * Check if password is already used
 */
router.post('/check-password', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
      });
    }

    const exists = await userRepository.checkPasswordExists(password);

    res.json({
      success: true,
      available: !exists,
    });
  } catch (error: any) {
    console.error('Password check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check password',
    });
  }
});

export default router;
