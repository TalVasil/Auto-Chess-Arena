import { ICharacter, CharacterRarity, AbilityEffect } from '../../types/game.types';

// =====================================================
// DEPRECATED: This file is no longer used
// =====================================================
// Characters are now loaded from the PostgreSQL database
//
// Server: Uses CharacterService (loads from DB on startup)
// Client: Fetches from GET /api/characters (loads once on app mount)
//
// This file is kept for reference only
// DO NOT IMPORT THIS FILE IN NEW CODE
// =====================================================

// Sample character pool for the game
export const CHARACTERS: ICharacter[] = [
  {
    id: 'warrior_1',
    name: 'Knight',
    emoji: '🛡️',
    cost: 1,
    rarity: CharacterRarity.COMMON,
    attack: 50,
    defense: 40,
    hp: 500,
    speed: 80,
        abilities: [
      {
        id: 'shield_bash',
        name: 'Shield Bash',
        description: 'Stuns enemy for 2 seconds',
        cooldown: 5,
        damage: 30,
        effect: AbilityEffect.STUN,
      },
    ],
  },
  {
    id: 'archer_1',
    name: 'Archer',
    emoji: '🏹',
    cost: 1,
    rarity: CharacterRarity.COMMON,
    attack: 60,
    defense: 20,
    hp: 400,
    speed: 120,
        abilities: [
      {
        id: 'piercing_arrow',
        name: 'Piercing Arrow',
        description: 'High damage shot',
        cooldown: 4,
        damage: 80,
      },
    ],
  },
  {
    id: 'mage_1',
    name: 'Mage',
    emoji: '🔮',
    cost: 2,
    rarity: CharacterRarity.UNCOMMON,
    attack: 70,
    defense: 15,
    hp: 350,
    speed: 90,
        abilities: [
      {
        id: 'fireball',
        name: 'Fireball',
        description: 'Area damage spell',
        cooldown: 6,
        damage: 100,
      },
    ],
  },
  {
    id: 'tank_1',
    name: 'Paladin',
    emoji: '⚔️',
    cost: 2,
    rarity: CharacterRarity.UNCOMMON,
    attack: 40,
    defense: 60,
    hp: 700,
    speed: 70,
        abilities: [
      {
        id: 'holy_shield',
        name: 'Holy Shield',
        description: 'Grants shield to self',
        cooldown: 8,
        effect: AbilityEffect.SHIELD,
      },
    ],
  },
  {
    id: 'assassin_1',
    name: 'Assassin',
    emoji: '🗡️',
    cost: 3,
    rarity: CharacterRarity.RARE,
    attack: 90,
    defense: 25,
    hp: 450,
    speed: 150,
        abilities: [
      {
        id: 'backstab',
        name: 'Backstab',
        description: 'Critical strike from behind',
        cooldown: 5,
        damage: 150,
      },
    ],
  },
  {
    id: 'healer_1',
    name: 'Cleric',
    emoji: '✨',
    cost: 3,
    rarity: CharacterRarity.RARE,
    attack: 30,
    defense: 35,
    hp: 500,
    speed: 100,
        abilities: [
      {
        id: 'heal',
        name: 'Healing Light',
        description: 'Heals allies',
        cooldown: 7,
        healing: 150,
      },
    ],
  },
  {
    id: 'dragon_knight',
    name: 'Dragon Knight',
    emoji: '🐉',
    cost: 4,
    rarity: CharacterRarity.EPIC,
    attack: 100,
    defense: 50,
    hp: 800,
    speed: 85,
        abilities: [
      {
        id: 'dragon_breath',
        name: 'Dragon Breath',
        description: 'Breathes fire on enemies',
        cooldown: 10,
        damage: 200,
      },
    ],
  },
  {
    id: 'archmage',
    name: 'Archmage',
    emoji: '🧙',
    cost: 5,
    rarity: CharacterRarity.LEGENDARY,
    attack: 120,
    defense: 30,
    hp: 600,
    speed: 95,
        abilities: [
      {
        id: 'meteor',
        name: 'Meteor Storm',
        description: 'Massive area damage',
        cooldown: 15,
        damage: 300,
      },
    ],
  },
];

// Helper function to get random characters for shop
export function getRandomCharacters(count: number): ICharacter[] {
  const shuffled = [...CHARACTERS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// Get character by ID
export function getCharacterById(id: string): ICharacter | undefined {
  return CHARACTERS.find((char) => char.id === id);
}

// Get characters by rarity
export function getCharactersByRarity(rarity: CharacterRarity): ICharacter[] {
  return CHARACTERS.filter((char) => char.rarity === rarity);
}

// Get characters by cost
export function getCharactersByCost(cost: number): ICharacter[] {
  return CHARACTERS.filter((char) => char.cost === cost);
}
