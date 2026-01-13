import React from 'react';
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
    targetRow?: number; // Target position row (-1 = no target)
    targetCol?: number; // Target position col (-1 = no target)
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

  // Grid layout constants (must match Arena.css)
  const CELL_WIDTH = 65;
  const CELL_HEIGHT = 60;
  const GAP = 2;
  const PADDING = 6;

  // Helper function to calculate center position of a cell
  const getCellCenterPosition = (row: number, col: number) => {
    // Position = padding + (cell size + gap) * index + cell size / 2
    const x = PADDING + (CELL_WIDTH + GAP) * col + CELL_WIDTH / 2;
    const y = PADDING + (CELL_HEIGHT + GAP) * row + CELL_HEIGHT / 2;
    return { x, y };
  };

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
    <div className="arena-container" style={{ position: 'relative' }}>
      <div className="arena-grid">
        {renderGrid()}
      </div>

      {/* Attack particles overlay */}
      <div
        className="attack-particles-overlay"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        {/* CSS for flowing particles */}
        <style>
          {`
            @keyframes flow-particle {
              0% {
                transform: translate(0, 0);
                opacity: 0;
              }
              10% {
                opacity: 1;
              }
              50% {
                transform: translate(calc(var(--dx) * 0.5), calc(var(--dy) * 0.5 - 40px));
                opacity: 1;
              }
              90% {
                opacity: 1;
              }
              100% {
                transform: translate(var(--dx), var(--dy));
                opacity: 0;
              }
            }
            .attack-particle {
              position: absolute;
              font-size: 24px;
              animation: flow-particle 1.5s ease-in-out infinite;
              will-change: transform, opacity;
              z-index: 9999;
              filter: drop-shadow(0 0 8px rgba(255, 255, 0, 0.8));
            }
          `}
        </style>

        {/* Draw flowing emoji particles */}
        {boardPositions.map((position, idx) => {
          if (!position?.character) return null;
          const char = position.character;

          // Skip if no target or attacker is dead
          if (char.targetRow === undefined || char.targetRow === -1) {
            console.log(`[Particle Skip] No target: ${char.emoji} at [${position.row},${position.col}] - targetRow=${char.targetRow}, targetCol=${char.targetCol}`);
            return null;
          }
          if ((char.currentHP ?? char.hp ?? 0) <= 0) {
            console.log(`[Particle Skip] Dead attacker: ${char.emoji} at [${position.row},${position.col}]`);
            return null;
          }

          console.log(`[Particle CREATE] ${char.emoji} at [${position.row},${position.col}] → target [${char.targetRow},${char.targetCol}]`);

          // Calculate positions using the same helper function
          const start = getCellCenterPosition(position.row, position.col);
          const end = getCellCenterPosition(char.targetRow!, char.targetCol!);

          // Calculate distance for animation
          const dx = end.x - start.x;
          const dy = end.y - start.y;

          return (
            <div
              key={`attack-${idx}`}
              className="attack-particle"
              style={{
                left: `${start.x}px`,
                top: `${start.y}px`,
                '--dx': `${dx}px`,
                '--dy': `${dy}px`,
              } as React.CSSProperties & { '--dx': string; '--dy': string }}
            >
              {char.emoji}
            </div>
          );
        })}
      </div>
    </div>
  );
}
