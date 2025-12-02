# Auto Chess Arena - Game Overview

## Game Concept

Auto Chess Arena is a real-time strategy multiplayer game for 8 players, combining tactical positioning, resource management, and automated combat. Players build armies of unique characters, position them strategically on a grid-based arena, and watch them battle autonomously against other players.

---

## Core Gameplay Loop

Each match consists of multiple rounds alternating between two distinct phases:

### **Preparation Phase**
Players prepare their strategy in their personal arena
- Receive income based on performance (win streaks + game progression)                            
- Earn 2 experience points automatically
- Purchase characters from the rotating shop
- Position characters on the battle arena or store them on the bench
- Upgrade characters and optimize team composition
- Timer counts down until combat begins

### **Combat Phase**
Characters fight automatically based on their programmed abilities
- Player is either defending their home arena or attacking an opponent's arena
- All character actions are autonomous - no player control during combat
- Battle continues until one side is eliminated
- Losing player takes damage based on surviving enemy units
- Winner receives 1 gold reward
- Round ends and returns to Preparation Phase

---

## Game Mechanics

### **Player Resources**

**Health Points (HP)**
- Each player starts with 100 HP
- Lose HP when defeated in combat (damage = opponent's surviving units)
- Reaching 0 HP eliminates player from the match
- Last player standing wins the game

**Gold**
- Earned through:
  - Winning combat (+1 gold)
  - Passive income each round (scales with game progression)
  - Win streak bonuses
- Spent on:
  - Purchasing characters from the shop
  - Rerolling the shop for new character options
  - Buying experience points to level up faster

**Experience (XP)**
- Gain 2 XP automatically each round
- Can purchase additional XP with gold
- Leveling up increases maximum team size and improves shop quality

---

## Game Layout

### **Home Arena** (Center-Top)
- 8×9 tile grid where characters are positioned for battle
- Each character occupies exactly 1×1 tile
- Strategic positioning is critical for combat effectiveness
- Only accessible during Preparation Phase

### **Bench** (Middle)
- 10 tile slots for storing characters not currently in battle
- Acts as reserve roster for tactical flexibility
- Characters can be freely moved between bench and arena during Preparation Phase
- Stored characters do not participate in combat

### **Shop** (Bottom)
- Displays 5 random characters available for purchase
- Character pool refreshes each round
- **Reroll Button** (Right): Spend gold to refresh available characters
- **Buy XP Button** (Left): Spend gold to gain experience points
- Each character has a gold cost and rarity tier

### **Scoreboard** (Right Side)
- Real-time display of all 8 players
- Shows current HP for each player
- Updates live as combat damage is dealt
- Visual indication of eliminated players
- Helps players assess competition and adjust strategy

### **Combat Bonuses Sidebar** (Left Side)
- Displays active team synergies and bonuses
- Shows character type combinations (e.g., "3 Warriors", "2 Mages")
- Lists combat stat bonuses granted by synergies
- Updates dynamically as team composition changes

---

## Win Conditions

### **Victory**
Be the last player standing with HP remaining above 0

### **Defeat**
HP reaches 0 from accumulated combat losses

### **Placement**
Players are ranked by elimination order (1st to 8th place)

---

## Key Strategic Elements

### **Team Composition**
- Choose characters that synergize together
- Balance offensive and defensive capabilities
- Adapt to opponents' strategies

### **Positioning**
- Place tanky characters in front to absorb damage
- Protect valuable damage dealers in the back
- Consider enemy team positioning and counter-position

### **Economy Management**
- Balance spending on characters vs saving for interest
- Decide when to reroll shop vs level up
- Manage win/loss streaks for bonus income

### **Timing & Adaptation**
- Know when to strengthen your team vs when to save resources
- Adapt strategy based on other players' compositions
- React to scoreboard information (who's strong, who's weak)

---

## Game Phases Summary

| Phase | Duration | Player Actions | Outcome |
|-------|----------|----------------|---------|
| **Preparation** | Timed (varies by round) | Buy characters, position team, manage resources | Team is locked when timer expires |
| **Combat** | Until one team eliminated | Watch automated battle | Winner gets +1 gold, loser takes HP damage |

---

## Unique Features

### **Automated Combat System**
- No player control during fights - pure strategy game
- Characters use abilities based on AI behavior and positioning
- Focus is on pre-battle preparation rather than mechanical skill

### **Simultaneous Multiplayer**
- All 8 players prepare simultaneously during Preparation Phase
- Players can be matched against different opponents each round
- Shared character pool creates competitive draft dynamics

### **Scalable Difficulty**
- Game difficulty increases as rounds progress
- Shop offers rarer, more powerful characters as the user’s level increases.
- Strategic depth increases with more gold and experience

### **Social Competition**
- Real-time scoreboard creates psychological pressure
- Players can observe overall meta and adapt
- Multiple players can adopt similar or counter-strategies

---

## Game Flow Example

**Round 1 (Early Game)**
1. Preparation Phase begins (configurable)
2. Receive 5 gold + 2 XP
3. Buy 2 characters from shop (3 gold each)
4. Place characters on arena
5. Combat Phase begins
6. Fight against Player 3's team
7. Victory! Receive 1 gold
8. No HP lost

**Round 5 (Mid Game)**
1. Preparation Phase (25 seconds)
2. Receive 8 gold (base + win streak) + 2 XP
3. Shop offers better characters due to level
4. Buy 1 character, reroll shop once
5. Rearrange team to counter popular strategies
6. Combat Phase begins
7. Fight against Player 7's team
8. Defeat - lose 12 HP (based on 12 surviving enemy units)
9. Current HP: 88/100

**Round 12 (Late Game)**
1. Only 3 players remain
2. Preparation Phase (30 seconds)
3. Receive 12 gold + 2 XP
4. High-level shop with rare powerful units
5. Optimize positioning against known opponent strategies
6. Combat Phase - crucial fight
7. Victory after intense battle
8. Opponent eliminated, you advance to final 2

---

## AI Integration Notes

This game design is structured for AI-assisted development:
- Clear separation of game phases and states
- Well-defined data structures (8×9 grid, player stats, character attributes)
- Deterministic combat system with rule-based AI
- Component-based UI architecture
- State machine pattern for game flow
- Modular systems (shop, combat, matchmaking)

The game loop, state management, and multiplayer synchronization can be implemented incrementally, making it ideal for iterative AI-assisted development.

---

## Technical State Machine

```
GAME_START
    ↓
MATCHMAKING (8 players)
    ↓
PREPARATION_PHASE
    ├─ Distribute Income
    ├─ Grant XP
    ├─ Enable Shop Interactions
    ├─ Enable Character Placement
    ├─ Timer Countdown
    ↓
PHASE_TRANSITION
    ├─ Lock Player Actions
    ├─ Determine Matchups
    ├─ Load Arenas
    ↓
COMBAT_PHASE
    ├─ Simulate Auto-Combat
    ├─ Calculate Damage
    ├─ Award Winner Gold
    ├─ Update HP
    ├─ Check Eliminations
    ↓
ROUND_END
    ├─ Update Scoreboard
    ├─ Check Win Condition
    ↓
[If Game Continues] → PREPARATION_PHASE
[If 1 Player Remains] → GAME_END

GAME_END
    ├─ Display Rankings
    ├─ Show Statistics
    └─ Return to Lobby
```

---

## Next Steps for Development

1. **Phase 1**: Core game loop (single-player vs AI)
2. **Phase 2**: Character definitions and combat system
3. **Phase 3**: Multiplayer networking and synchronization
4. **Phase 4**: UI/UX polish and visual effects
5. **Phase 5**: Balance, testing, and deployment

This document serves as the foundation for all development efforts. All features, mechanics, and technical implementations should reference back to this game design specification.
