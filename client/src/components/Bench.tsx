import { ICharacter } from '../../../shared/src/types/game.types';
import { BENCH_CONFIG } from '../../../shared/src/constants/gameConfig';
import './Bench.css';

interface BenchProps {
  characters: (ICharacter | null)[];
}

export function Bench({ characters }: BenchProps) {
  // Ensure we always have exactly 10 slots
  const slots = Array(BENCH_CONFIG.MAX_SLOTS).fill(null).map((_, index) => {
    return characters[index] || null;
  });

  return (
    <div className="bench">
      <div className="bench-header">
        <h3>📦 Bench</h3>
        <span className="bench-count">
          {characters.filter(c => c !== null).length}/{BENCH_CONFIG.MAX_SLOTS}
        </span>
      </div>

      <div className="bench-slots">
        {slots.map((character, index) => (
          <div
            key={index}
            className={`bench-slot ${character ? 'occupied' : 'empty'}`}
          >
            {character ? (
              <>
                <div className="slot-character">
                  <div className="slot-icon">⚔️</div>
                  <div className="slot-name">{character.name}</div>
                  <div className="slot-stats">
                    <span title="Cost">💰{character.cost}</span>
                  </div>
                </div>
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
