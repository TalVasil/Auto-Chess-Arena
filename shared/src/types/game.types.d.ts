export declare enum GamePhase {
    WAITING = "WAITING",
    PREPARATION = "PREPARATION",
    COMBAT = "COMBAT",
    GAME_END = "GAME_END"
}
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
export interface ICharacter {
    id: string;
    name: string;
    emoji: string;
    cost: number;
    rarity: CharacterRarity;
    attack: number;
    defense: number;
    hp: number;
    speed: number;
    abilities: IAbility[];
    imageUrl: string;
}
export declare enum CharacterRarity {
    COMMON = "COMMON",
    UNCOMMON = "UNCOMMON",
    RARE = "RARE",
    EPIC = "EPIC",
    LEGENDARY = "LEGENDARY"
}
export interface IAbility {
    id: string;
    name: string;
    description: string;
    cooldown: number;
    damage?: number;
    healing?: number;
    effect?: AbilityEffect;
}
export declare enum AbilityEffect {
    STUN = "STUN",
    SLOW = "SLOW",
    SHIELD = "SHIELD",
    BUFF_ATTACK = "BUFF_ATTACK",
    BUFF_DEFENSE = "BUFF_DEFENSE"
}
export interface IPosition {
    x: number;
    y: number;
}
export interface IArena {
    width: number;
    height: number;
    characters: Map<string, IPosition>;
}
export interface IShop {
    availableCharacters: ICharacter[];
    rerollCost: number;
    xpCost: number;
}
export interface IGameState {
    phase: GamePhase;
    roundNumber: number;
    timer: number;
    players: Map<string, IPlayer>;
}
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
export declare enum CombatEventType {
    ATTACK = "ATTACK",
    ABILITY_CAST = "ABILITY_CAST",
    DEATH = "DEATH",
    HEAL = "HEAL"
}
//# sourceMappingURL=game.types.d.ts.map