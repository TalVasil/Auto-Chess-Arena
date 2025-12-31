import { ICharacter } from '../../../shared/src/types/game.types';
import { BENCH_CONFIG } from '../../../shared/src/constants/gameConfig';
import './Bench.css';

interface BenchProps {
  characters: (ICharacter | null)[];
  playerGold: number;
  selectedBenchIndex: number | null;
  onSelectCharacter: (index: number) => void;
  onBenchSlotClick?: (index: number) => void;
  onSellCharacter?: (index: number) => void;
  onSwapBench?: (fromIndex: number, toIndex: number) => void;
}

export function Bench({ characters, playerGold, selectedBenchIndex, onSelectCharacter, onBenchSlotClick, onSellCharacter, onSwapBench }: BenchProps) {
  // Ensure we always have exactly 10 slots
  const slots = Array(BENCH_CONFIG.MAX_SLOTS).fill(null).map((_, index) => {
    return characters[index] || null;
  });

  const handleBenchClick = (index: number, character: ICharacter | null) => {
    // If there's a character selected from bench
    if (selectedBenchIndex !== null && selectedBenchIndex !== index) {
      // Swap or move to this slot
      if (onSwapBench) {
        onSwapBench(selectedBenchIndex, index);
      }
      return;
    }

    // Normal selection/deselection
    if (character) {
      onSelectCharacter(index);
    } else if (onBenchSlotClick) {
      onBenchSlotClick(index);
    }
  };

  return (
    <div className="bench">
      <div className="bench-header">
        <h3>📦 Bench</h3>
        <div className="bench-info">
          <span className="bench-count">
            {characters.filter(c => c !== null).length}/{BENCH_CONFIG.MAX_SLOTS}
          </span>
          <span className="bench-gold">
            💰 {playerGold}g
          </span>
        </div>
      </div>

      <div className="bench-slots">
        {slots.map((character, index) => (
          <div
            key={index}
            className={`bench-slot ${character ? 'occupied' : 'empty'} ${selectedBenchIndex === index ? 'selected' : ''}`}
            onClick={() => handleBenchClick(index, character)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (character && onSellCharacter) {
                onSellCharacter(index);
              }
            }}
          >
            {character ? (
              <>
                <div className="slot-character">
                  <div className="slot-icon">{character.emoji}</div>
                  <div className="slot-name">{character.name}</div>
                  <div className="slot-stats">
                    <span title="Cost">💰{character.cost}</span>
                  </div>
                </div>
                {onSellCharacter && (
                  <div className="sell-indicator" title={`Right-click to sell for ${character.cost}g`}>
                    💰
                  </div>
                )}
              </>
            ) : (
              <div className="slot-empty-indicator">
                <span className="empty-icon">+</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
