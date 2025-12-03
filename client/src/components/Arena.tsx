import './Arena.css';

interface BoardPosition {
  row: number;
  col: number;
  character?: {
    id: string;
    name: string;
    cost: number;
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
            {position?.character && (
              <div className="arena-character">
                ⚔️
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
