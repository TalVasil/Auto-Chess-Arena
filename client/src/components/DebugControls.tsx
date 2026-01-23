import { gameClient } from '../network/GameClient';
import { useGameStore } from '../store/gameStore';
import { Tooltip } from './Tooltip';
import './DebugControls.css';

interface DebugControlsProps {
  phase: 'WAITING' | 'PREPARATION' | 'COMBAT' | 'GAME_END';
  onCancelGame?: () => void;
}

export function DebugControls({ phase, onCancelGame }: DebugControlsProps) {
  const { debugMode } = useGameStore();

  if (!debugMode) {
    return null;
  }

  const handleToggleTimer = () => {
    gameClient.send('debug_toggle_timer');
  };

  const handleNextPhase = () => {
    gameClient.send('debug_next_round');
  };

  const handleRestartGame = () => {
    gameClient.send('debug_reset_game');
  };

  const handleCancelGame = () => {
    if (onCancelGame) {
      onCancelGame();
    } else {
      gameClient.send('cancel_game');
    }
  };

  return (
    <div className="debug-controls">
      <div className="debug-label">🐛 DEBUG</div>
      <div className="debug-buttons">
        {phase === 'WAITING' && (
          <Tooltip text="Cancel the game for all players">
            <button className="debug-btn debug-btn-cancel" onClick={handleCancelGame}>
              ❌ Cancel
            </button>
          </Tooltip>
        )}

        {(phase === 'PREPARATION' || phase === 'COMBAT') && (
          <>
            <Tooltip text="Pause or resume the timer">
              <button className="debug-btn debug-btn-timer" onClick={handleToggleTimer}>
                ⏯️ Timer
              </button>
            </Tooltip>
            <Tooltip text="Skip to the next phase">
              <button className="debug-btn debug-btn-next" onClick={handleNextPhase}>
                ⏭️ Next
              </button>
            </Tooltip>
            <Tooltip text="Restart the game from round 1">
              <button className="debug-btn debug-btn-restart" onClick={handleRestartGame}>
                🔄 Restart
              </button>
            </Tooltip>
            <Tooltip text="Cancel the game for all players">
              <button className="debug-btn debug-btn-cancel" onClick={handleCancelGame}>
                ❌ Cancel
              </button>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
