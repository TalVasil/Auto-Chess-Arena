// Game Phase Types
export enum GamePhase {
  WAITING = 'WAITING',
  PREPARATION = 'PREPARATION',
  COMBAT = 'COMBAT',
  GAME_END = 'GAME_END',
}

// Player Types
export interface IPlayer {
  id: string;
  username: string;
  hp: number;
  gold: number;
  xp: number;
  level: number;
  isReady: boolean;
  isEliminated: boolean;
}

// Character Types
export interface ICharacter {
  id: string;
  name: string;
  emoji: string; // Visual representation using emoji
  cost: number;
  rarity: CharacterRarity;
  attack: number;
  defense: number;
  hp: number;
  speed: number;
  abilities: IAbility[];
  imageUrl: string;
}

export enum CharacterRarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
}

// Ability Types
export interface IAbility {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  damage?: number;
  healing?: number;
  effect?: AbilityEffect;
}

export enum AbilityEffect {
  STUN = 'STUN',
  SLOW = 'SLOW',
  SHIELD = 'SHIELD',
  BUFF_ATTACK = 'BUFF_ATTACK',
  BUFF_DEFENSE = 'BUFF_DEFENSE',
}

// Position Types
export interface IPosition {
  x: number;
  y: number;
}

// Arena Types
export interface IArena {
  width: number;
  height: number;
  characters: Map<string, IPosition>; // characterId -> position
}

// Shop Types
export interface IShop {
  availableCharacters: ICharacter[];
  rerollCost: number;
  xpCost: number;
}

// Game State Types
export interface IGameState {
  phase: GamePhase;
  roundNumber: number;
  timer: number;
  players: Map<string, IPlayer>;
}

// Combat Types
export interface ICombatResult {
  winnerId: string;
  loserId: string;
  damage: number;
  survivingUnits: number;
  combatLog: ICombatEvent[];
}

export interface ICombatEvent {
  timestamp: number;
  type: CombatEventType;
  actorId: string;
  targetId?: string;
  damage?: number;
  healing?: number;
}

export enum CombatEventType {
  ATTACK = 'ATTACK',
  ABILITY_CAST = 'ABILITY_CAST',
  DEATH = 'DEATH',
  HEAL = 'HEAL',
}
