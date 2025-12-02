// Arena Configuration
export const ARENA_CONFIG = {
  WIDTH: 8,
  HEIGHT: 9,
  TILE_SIZE: 100, // pixels
};

// Bench Configuration
export const BENCH_CONFIG = {
  MAX_SLOTS: 10,
};

// Shop Configuration
export const SHOP_CONFIG = {
  CHARACTERS_PER_REFRESH: 5,
  REROLL_COST: 2,
  XP_COST: 4,
};

// Player Configuration
export const PLAYER_CONFIG = {
  STARTING_HP: 100,
  STARTING_GOLD: 5,
  STARTING_XP: 0,
  STARTING_LEVEL: 1,
  MAX_LEVEL: 10,
};

// Round Configuration
export const ROUND_CONFIG = {
  PREPARATION_TIME: 30, // seconds
  MIN_PLAYERS_TO_START: 2,
  MAX_PLAYERS: 8,
};

// Economy Configuration
export const ECONOMY_CONFIG = {
  BASE_INCOME: 5,
  WIN_STREAK_BONUS: [0, 1, 2, 3, 3], // Bonus for 0, 1, 2, 3, 4+ wins
  LOSS_STREAK_BONUS: [0, 1, 2, 3, 3], // Bonus for 0, 1, 2, 3, 4+ losses
  INTEREST_RATE: 0.1, // 10% of gold (max 5 gold)
  MAX_INTEREST: 5,
};

// Level Up Requirements
export const LEVEL_UP_XP = {
  1: 0,
  2: 2,
  3: 6,
  4: 10,
  5: 20,
  6: 36,
  7: 56,
  8: 80,
  9: 108,
  10: 999, // Max level
};

// Damage Configuration
export const DAMAGE_CONFIG = {
  BASE_DAMAGE: 1,
  PER_UNIT_DAMAGE: 2,
  PER_LEVEL_DAMAGE: 1,
};
