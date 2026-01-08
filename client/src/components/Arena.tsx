import './Arena.css';

// Helper function to trigger attack animation (for testing)
export const triggerAttackAnimation = (characterId: string) => {
  const element = document.querySelector(`[data-char-id="${characterId}"]`);
  if (element) {
    element.classList.add('attack-shake');
    setTimeout(() => {
      element.classList.remove('attack-shake');
    }, 400);
  }
};

interface BoardPosition {
  row: number;
  col: number;
  character?: {
    id: string;
    name: string;
    emoji: string;
    cost: number;
    hp?: number;        // Max HP
    currentHP?: number; // Current HP (will use hp if not set)
    attack?: number;    // Attack stat
    defense?: number;   // Defense stat
  };
}

interface ArenaProps {
  boardPositions: BoardPosition[];
  selectedArenaPos: {row: number, col: number} | null;
  onCellClick: (row: number, col: number) => void;
}

export function Arena({ boardPositions, selectedArenaPos, onCellClick }: ArenaProps) {
  const COLUMNS = 9;
  const ROWS = 8;

  // Helper function to get HP bar color based on percentage
  const getHPColor = (hpPercent: number): string => {
    if (hpPercent > 0.6) return '#4caf50'; // Green
    if (hpPercent > 0.3) return '#ff9800'; // Orange
    return '#f44336'; // Red
  };

  // Generate grid cells
  const renderGrid = () => {
    const cells = [];

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        // Determine which side this cell belongs to
        // Left 4 columns (0-3) = opponent side
        // Middle column (4) = neutral zone
        // Right 4 columns (5-8) = player side
        let cellClass = 'arena-cell';

        if (col <= 3) {
          cellClass += ' arena-cell-opponent';
        } else if (col === 4) {
          cellClass += ' arena-cell-neutral';
        } else {
          cellClass += ' arena-cell-player';
        }

        // Find if there's a character at this position
        const position = boardPositions.find(pos => pos.row === row && pos.col === col);

        // Check if this cell is selected
        const isSelected = selectedArenaPos?.row === row && selectedArenaPos?.col === col;
        if (isSelected) {
          cellClass += ' arena-cell-selected';
        }

        cells.push(
          <div
            key={`${row}-${col}`}
            className={cellClass}
            data-row={row}
            data-col={col}
            onClick={() => onCellClick(row, col)}
          >
            {position?.character && ((position.character.currentHP ?? position.character.hp ?? 0) > 0) && (
              <div
                className="arena-character"
                title={position.character.name}
                data-char-id={position.character.id}
              >
                <div className="character-emoji">{position.character.emoji}</div>

                {/* HP Bar */}
                {(() => {
                  const char = position.character;
                  const currentHp = char.currentHP ?? char.hp ?? 100;
                  const maxHp = char.hp ?? 100;
                  const hpPercent = currentHp / maxHp;

                  return (
                    <>
                      <div className="hp-bar-container">
                        <div
                          className="hp-bar-fill"
                          style={{
                            width: `${hpPercent * 100}%`,
                            backgroundColor: getHPColor(hpPercent)
                          }}
                        />
                      </div>
                      <div className="character-hp">
                        {currentHp} / {maxHp}
                      </div>
                    </>
                  );
                })()}

                {/* Stats Tooltip (shows on hover) */}
                <div className="character-stats-tooltip">
                  <div className="stat-line">
                    <span className="stat-icon">⚔️</span>
                    <span className="stat-value">{position.character.attack ?? 10}</span>
                  </div>
                  <div className="stat-line">
                    <span className="stat-icon">🛡️</span>
                    <span className="stat-value">{position.character.defense ?? 5}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      }
    }

    return cells;
  };

  return (
    <div className="arena-container">
      <div className="arena-grid">
        {renderGrid()}
      </div>
    </div>
  );
}
