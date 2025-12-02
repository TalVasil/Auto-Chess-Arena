-- =====================================================
-- Auto Chess Arena - Database Schema
-- Purpose: User authentication and session management
-- =====================================================

-- NOTE: Tables are created only if they don't exist
-- This preserves existing data across server restarts

-- =====================================================
-- Users Table
-- Stores user accounts for authentication
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(20) UNIQUE NOT NULL,
  password VARCHAR(20) UNIQUE NOT NULL,  -- UNIQUE + PLAIN TEXT (testing only)
  email VARCHAR(255) NOT NULL,  -- NOT UNIQUE (for easier testing)
  display_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP DEFAULT NOW(),

  -- Constraints
  CONSTRAINT username_length CHECK (LENGTH(username) >= 3 AND LENGTH(username) <= 20),
  CONSTRAINT password_length CHECK (LENGTH(password) >= 8 AND LENGTH(password) <= 20),
  CONSTRAINT email_valid CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- =====================================================
-- Refresh Tokens Table
-- Stores long-lived tokens for "Remember Me" feature
-- =====================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_password ON users(password);  -- For unique password check

-- Refresh tokens table indexes
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- =====================================================
-- Cleanup Function (Optional)
-- Automatically delete expired refresh tokens
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM refresh_tokens WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Sample Test Data (Optional - for testing)
-- Uncomment to create test users
-- =====================================================
-- INSERT INTO users (username, password, email, display_name) VALUES
--   ('testuser1', 'password123', 'test1@example.com', 'Player One'),
--   ('testuser2', 'password456', 'test2@example.com', 'Player Two'),
--   ('admin', 'admin12345', 'admin@example.com', 'Admin User');
