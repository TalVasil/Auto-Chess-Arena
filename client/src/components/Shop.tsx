import { ICharacter } from '../../../shared/src/types/game.types';
import { Character } from '../store/gameStore';
import { gameClient } from '../network/GameClient';
import './Shop.css';

interface ShopProps {
  characters: ICharacter[];
  playerGold: number;
  phase: string;
  selectedBenchIndex: number | null;
  benchCharacters: Character[];
  selectedArenaPos: {row: number, col: number} | null;
  arenaCharacters: (Character | null)[];
  onBuy: (characterId: string) => void;
  onSellSelectedCharacter?: () => void;
  onSellArenaCharacter?: () => void;
}

export function Shop({ characters, playerGold, phase, selectedBenchIndex, benchCharacters, selectedArenaPos, arenaCharacters, onBuy, onSellSelectedCharacter, onSellArenaCharacter }: ShopProps) {
  const handleBuy = (character: ICharacter) => {
    if (playerGold >= character.cost) {
      onBuy(character.id);
      gameClient.send('buy_character', { characterId: character.id });
    }
  };

  const handleReroll = () => {
    gameClient.send('reroll_shop');
  };

  const getRarityColor = (rarity: string): string => {
    switch (rarity) {
      case 'COMMON':
        return '#808080';
      case 'UNCOMMON':
        return '#00ff00';
      case 'RARE':
        return '#0080ff';
      case 'EPIC':
        return '#a020f0';
      case 'LEGENDARY':
        return '#ffa500';
      default:
        return '#ffffff';
    }
  };

  // Get selected character info for sell mode - check both bench and arena
  let selectedCharacter = null;
  let sellHandler = null;

  if (selectedBenchIndex !== null && benchCharacters[selectedBenchIndex]) {
    selectedCharacter = benchCharacters[selectedBenchIndex];
    sellHandler = onSellSelectedCharacter;
  } else if (selectedArenaPos !== null && arenaCharacters) {
    const arenaIndex = selectedArenaPos.row * 7 + selectedArenaPos.col;
    if (arenaIndex >= 0 && arenaIndex < arenaCharacters.length && arenaCharacters[arenaIndex]) {
      selectedCharacter = arenaCharacters[arenaIndex];
      sellHandler = onSellArenaCharacter;
    }
  }

  const isSellMode = selectedCharacter !== null && sellHandler !== undefined;

  return (
    <div className="shop" style={{ position: 'relative' }}>
      {/* Floating Sell Button - centered in the middle of shop */}
      {isSellMode && selectedCharacter && sellHandler && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 100,
          }}
        >
          <button
            onClick={sellHandler}
            style={{
              background: 'linear-gradient(135deg, rgba(255, 217, 0, 1) 0%, rgba(255, 0, 0, 1) 100%)',
              border: '3px solid #d9ff00ff',
              borderRadius: '12px',
              padding: '0.8rem 2rem',
              cursor: 'pointer',
              color: '#000000ff',
              fontWeight: 'bold',
              fontSize: '1rem',
              boxShadow: '0 0 20px rgba(255, 217, 0, 1)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(255, 215, 0, 0.6)';
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.5) 0%, rgba(255, 165, 0, 0.5) 100%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.4)';
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 215, 0, 0.3) 0%, rgba(255, 165, 0, 0.3) 100%)';
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>💰</span>
            <span>Sell {selectedCharacter.name} for {selectedCharacter.cost}g</span>
          </button>
        </div>
      )}
        <div className="shop-content">
        <div className="shop-sidebar">
          <h2>🛒 Shop</h2>
          <div className="shop-actions">
            <button
              className="shop-action-btn"
              disabled={playerGold < 2}
              onClick={handleReroll}
            >
              🔄 Reroll<br/>(2g)
            </button>
            <button className="shop-action-btn" disabled>
              ⭐ Buy XP<br/>(4g)
            </button>
          </div>
        </div>

        <div className="shop-characters">
        {characters && characters.length > 0 ? characters.map((character) => {
          if (!character) return null;
          const canAfford = playerGold >= character.cost;

          return (
            <div
              key={character.id}
              className={`character-card ${!canAfford ? 'disabled' : ''}`}
              style={{
                borderColor: getRarityColor(character.rarity),
                backgroundImage: `url('/characters/${character.id}.png')`,
              }}
            >
              <div className="character-info">
                <div
                  className="character-name"
                  style={{ color: getRarityColor(character.rarity) }}
                >
                  {character.name}
                </div>

                <div className="character-stats">
                  <span className="stat" title="Attack">
                    ⚔️ {character.attack}
                  </span>
                  <span className="stat" title="Defense">
                    🛡️ {character.defense}
                  </span>
                  <span className="stat" title="HP">
                    ❤️ {character.hp}
                  </span>
                </div>
              </div>

              <div className="character-footer">
                {character.abilities.length > 0 && (
                  <div className="character-ability">
                    <span className="ability-name">
                      ✨ {character.abilities[0].name}
                    </span>
                  </div>
                )}

                <button
                  className={`buy-button ${!canAfford ? 'disabled' : ''}`}
                  onClick={() => handleBuy(character)}
                  disabled={!canAfford}
                >
                  <span className="buy-cost">{character.cost}g</span>
                  <span className="buy-text">Buy</span>
                </button>
              </div>
            </div>
          );
        }) : <div style={{padding: '2rem', color: '#fff', textAlign: 'center'}}>No characters in shop</div>}
        </div>
      </div>
    </div>
  );
}
