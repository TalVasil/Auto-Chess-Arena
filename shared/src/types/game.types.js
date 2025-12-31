// Game Phase Types
export var GamePhase;
(function (GamePhase) {
    GamePhase["WAITING"] = "WAITING";
    GamePhase["PREPARATION"] = "PREPARATION";
    GamePhase["COMBAT"] = "COMBAT";
    GamePhase["GAME_END"] = "GAME_END";
})(GamePhase || (GamePhase = {}));
export var CharacterRarity;
(function (CharacterRarity) {
    CharacterRarity["COMMON"] = "COMMON";
    CharacterRarity["UNCOMMON"] = "UNCOMMON";
    CharacterRarity["RARE"] = "RARE";
    CharacterRarity["EPIC"] = "EPIC";
    CharacterRarity["LEGENDARY"] = "LEGENDARY";
})(CharacterRarity || (CharacterRarity = {}));
export var AbilityEffect;
(function (AbilityEffect) {
    AbilityEffect["STUN"] = "STUN";
    AbilityEffect["SLOW"] = "SLOW";
    AbilityEffect["SHIELD"] = "SHIELD";
    AbilityEffect["BUFF_ATTACK"] = "BUFF_ATTACK";
    AbilityEffect["BUFF_DEFENSE"] = "BUFF_DEFENSE";
})(AbilityEffect || (AbilityEffect = {}));
export var CombatEventType;
(function (CombatEventType) {
    CombatEventType["ATTACK"] = "ATTACK";
    CombatEventType["ABILITY_CAST"] = "ABILITY_CAST";
    CombatEventType["DEATH"] = "DEATH";
    CombatEventType["HEAL"] = "HEAL";
})(CombatEventType || (CombatEventType = {}));
//# sourceMappingURL=game.types.js.map