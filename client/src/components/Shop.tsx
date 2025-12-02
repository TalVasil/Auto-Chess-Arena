import { ICharacter } from '../../../shared/src/types/game.types';
import { gameClient } from '../network/GameClient';
import './Shop.css';

interface ShopProps {
  characters: ICharacter[];
  playerGold: number;
  onBuy: (characterId: string) => void;
}

export function Shop({ characters, playerGold, onBuy }: ShopProps) {
  const handleBuy = (character: ICharacter) => {
    if (playerGold >= character.cost) {
      onBuy(character.id);
      // Send message to server
      gameClient.send('buy_character', { characterId: character.id });
    }
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

  return (
    <div className="shop">
      <div className="shop-header">
        <h2>🛒 Shop</h2>
        <div className="shop-gold">
          <span className="gold-icon">💰</span>
          <span className="gold-amount">{playerGold}g</span>
        </div>
      </div>

      <div className="shop-characters">
        {characters.map((character) => {
          const canAfford = playerGold >= character.cost;

          return (
            <div
              key={character.id}
              className={`character-card ${!canAfford ? 'disabled' : ''}`}
              style={{
                borderColor: getRarityColor(character.rarity),
              }}
            >
              <div className="character-image-placeholder">
                <span className="character-icon">⚔️</span>
              </div>

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

                {character.abilities.length > 0 && (
                  <div className="character-ability">
                    <span className="ability-name">
                      ✨ {character.abilities[0].name}
                    </span>
                  </div>
                )}
              </div>

              <button
                className={`buy-button ${!canAfford ? 'disabled' : ''}`}
                onClick={() => handleBuy(character)}
                disabled={!canAfford}
              >
                <span className="buy-cost">{character.cost}g</span>
                <span className="buy-text">Buy</span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="shop-actions">
        <button className="shop-action-btn" disabled>
          🔄 Reroll (2g)
        </button>
        <button className="shop-action-btn" disabled>
          ⭐ Buy XP (4g)
        </button>
      </div>
    </div>
  );
}
