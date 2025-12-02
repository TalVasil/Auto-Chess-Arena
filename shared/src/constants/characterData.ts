import { ICharacter, CharacterRarity, AbilityEffect } from '../types/game.types';

// Sample character pool for the game
export const CHARACTERS: ICharacter[] = [
  {
    id: 'warrior_1',
    name: 'Knight',
    cost: 1,
    rarity: CharacterRarity.COMMON,
    attack: 50,
    defense: 40,
    hp: 500,
    imageUrl: '/assets/characters/knight.png',
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
    cost: 1,
    rarity: CharacterRarity.COMMON,
    attack: 60,
    defense: 20,
    hp: 400,
    imageUrl: '/assets/characters/archer.png',
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
    cost: 2,
    rarity: CharacterRarity.UNCOMMON,
    attack: 70,
    defense: 15,
    hp: 350,
    imageUrl: '/assets/characters/mage.png',
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
    cost: 2,
    rarity: CharacterRarity.UNCOMMON,
    attack: 40,
    defense: 60,
    hp: 700,
    imageUrl: '/assets/characters/paladin.png',
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
    cost: 3,
    rarity: CharacterRarity.RARE,
    attack: 90,
    defense: 25,
    hp: 450,
    imageUrl: '/assets/characters/assassin.png',
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
    cost: 3,
    rarity: CharacterRarity.RARE,
    attack: 30,
    defense: 35,
    hp: 500,
    imageUrl: '/assets/characters/cleric.png',
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
    cost: 4,
    rarity: CharacterRarity.EPIC,
    attack: 100,
    defense: 50,
    hp: 800,
    imageUrl: '/assets/characters/dragon_knight.png',
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
    cost: 5,
    rarity: CharacterRarity.LEGENDARY,
    attack: 120,
    defense: 30,
    hp: 600,
    imageUrl: '/assets/characters/archmage.png',
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
