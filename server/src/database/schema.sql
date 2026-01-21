-- =====================================================
-- Auto Chess Arena - Database Schema
-- Purpose: User authentication and session management
-- =====================================================

-- NOTE: Tables are created only if they don't exist
-- This preserves existing data across server restarts

-- =====================================================
-- Characters Table
-- Stores game character definitions
-- =====================================================
CREATE TABLE IF NOT EXISTS characters (
  id VARCHAR(50) PRIMARY KEY,           -- e.g., 'warrior_1', 'mage_1'
  name VARCHAR(100) NOT NULL,           -- Display name (e.g., 'Knight')
  emoji VARCHAR(10) NOT NULL,           -- Visual representation
  cost INTEGER NOT NULL CHECK (cost >= 1 AND cost <= 5),
  rarity VARCHAR(20) NOT NULL,          -- COMMON, UNCOMMON, RARE, EPIC, LEGENDARY
  attack INTEGER NOT NULL CHECK (attack >= 0),
  defense INTEGER NOT NULL CHECK (defense >= 0),
  hp INTEGER NOT NULL CHECK (hp > 0),
  speed INTEGER NOT NULL CHECK (speed > 0),
  is_active BOOLEAN DEFAULT true,       -- Enable/disable in shop pool
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- Character Abilities Table
-- Stores abilities for characters (one-to-many)
-- =====================================================
CREATE TABLE IF NOT EXISTS character_abilities (
  id SERIAL PRIMARY KEY,
  character_id VARCHAR(50) NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  ability_id VARCHAR(50) NOT NULL,      -- e.g., 'shield_bash', 'fireball'
  name VARCHAR(100) NOT NULL,           -- Display name
  description TEXT NOT NULL,
  cooldown INTEGER NOT NULL CHECK (cooldown > 0),
  damage INTEGER,                       -- Optional: for damage abilities
  healing INTEGER,                      -- Optional: for healing abilities
  effect VARCHAR(50),                   -- Optional: STUN, SLOW, SHIELD, etc.
  sort_order INTEGER DEFAULT 0,         -- For multiple abilities per character
  created_at TIMESTAMP DEFAULT NOW()
);

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

-- Characters table indexes
CREATE INDEX IF NOT EXISTS idx_characters_cost ON characters(cost);
CREATE INDEX IF NOT EXISTS idx_characters_rarity ON characters(rarity);
CREATE INDEX IF NOT EXISTS idx_characters_active ON characters(is_active) WHERE is_active = true;

-- Character abilities table indexes
CREATE INDEX IF NOT EXISTS idx_abilities_character ON character_abilities(character_id);
CREATE INDEX IF NOT EXISTS idx_abilities_sort ON character_abilities(character_id, sort_order);

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
-- Character Seed Data
-- Initial 8 characters from characterData.ts
-- =====================================================

-- Insert characters (only if table is empty)
INSERT INTO characters (id, name, emoji, cost, rarity, attack, defense, hp, speed)
SELECT * FROM (VALUES
  ('warrior_1', 'Knight', '🛡️', 1, 'COMMON', 50, 40, 500, 80),
  ('archer_1', 'Archer', '🏹', 1, 'COMMON', 60, 20, 400, 120),
  ('mage_1', 'Mage', '🔮', 2, 'UNCOMMON', 70, 15, 350, 90),
  ('tank_1', 'Paladin', '⚔️', 2, 'UNCOMMON', 40, 60, 700, 70),
  ('assassin_1', 'Assassin', '🗡️', 3, 'RARE', 90, 25, 450, 150),
  ('healer_1', 'Cleric', '✨', 3, 'RARE', 30, 35, 500, 100),
  ('dragon_knight', 'Dragon Knight', '🐉', 4, 'EPIC', 100, 50, 800, 85),
  ('archmage', 'Archmage', '🧙', 5, 'LEGENDARY', 120, 30, 600, 95)
) AS v(id, name, emoji, cost, rarity, attack, defense, hp, speed)
WHERE NOT EXISTS (SELECT 1 FROM characters LIMIT 1);

-- Insert character abilities (only if table is empty)
INSERT INTO character_abilities (character_id, ability_id, name, description, cooldown, damage, healing, effect, sort_order)
SELECT * FROM (VALUES
  ('warrior_1', 'shield_bash', 'Shield Bash', 'Stuns enemy for 2 seconds', 5, 30, NULL, 'STUN', 0),
  ('archer_1', 'piercing_arrow', 'Piercing Arrow', 'High damage shot', 4, 80, NULL, NULL, 0),
  ('mage_1', 'fireball', 'Fireball', 'Area damage spell', 6, 100, NULL, NULL, 0),
  ('tank_1', 'holy_shield', 'Holy Shield', 'Grants shield to self', 8, NULL, NULL, 'SHIELD', 0),
  ('assassin_1', 'backstab', 'Backstab', 'Critical strike from behind', 5, 150, NULL, NULL, 0),
  ('healer_1', 'heal', 'Healing Light', 'Heals allies', 7, NULL, 150, NULL, 0),
  ('dragon_knight', 'dragon_breath', 'Dragon Breath', 'Breathes fire on enemies', 10, 200, NULL, NULL, 0),
  ('archmage', 'meteor', 'Meteor Storm', 'Massive area damage', 15, 300, NULL, NULL, 0)
) AS v(character_id, ability_id, name, description, cooldown, damage, healing, effect, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM character_abilities LIMIT 1);

-- =====================================================
-- Game Sessions Table
-- Stores active game state snapshots for recovery
-- =====================================================
CREATE TABLE IF NOT EXISTS game_sessions (
  id SERIAL PRIMARY KEY,
  room_id VARCHAR(100) UNIQUE NOT NULL,
  old_room_id VARCHAR(100),
  game_state_json JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_updated_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + interval '30 minutes',
  is_active BOOLEAN DEFAULT true
);

-- Add old_room_id column if it doesn't exist (migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'old_room_id'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN old_room_id VARCHAR(100);
  END IF;
END $$;

-- =====================================================
-- Game Session Indexes
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_game_sessions_room_id ON game_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_old_room_id ON game_sessions(old_room_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_active ON game_sessions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_game_sessions_expires ON game_sessions(expires_at);

-- =====================================================
-- Cleanup Function for Expired Game Sessions
-- Automatically delete old game sessions
-- =====================================================
CREATE OR REPLACE FUNCTION cleanup_expired_game_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM game_sessions WHERE expires_at < NOW() AND is_active = false;
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
