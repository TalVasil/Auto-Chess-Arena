import { useState, useEffect } from 'react';
import { Box, VStack, HStack, Text, Button } from '@chakra-ui/react';
import { useGameStore } from '../store/gameStore';
import { Arena } from './Arena';
import { Bench } from './Bench';
import { Shop } from './Shop';
import { gameClient } from '../network/GameClient';
import { LEVEL_UP_XP, PLAYER_CONFIG } from '../../../shared/src/constants/gameConfig';

export function GamePlay() {
  const {
    phase,
    roundNumber,
    timer,
    players,
    mySessionId,
    myOpponentId,
    myOpponentName,
    allCharacters,
    logout,
    leaveGame
  } = useGameStore();
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number | null>(null);
  const [selectedArenaPos, setSelectedArenaPos] = useState<{row: number, col: number} | null>(null);
  const [cursorIcon, setCursorIcon] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [levelUpModal, setLevelUpModal] = useState<{ isOpen: boolean; level: number; message: string }>({
    isOpen: false,
    level: 0,
    message: ''
  });

  // Get my player info
  const myPlayer = players.find((p) => p.id === mySessionId);

  // Get opponent player info
  // Note: Even if opponent is disconnected, their data should remain in players array
  // because server keeps disconnected players for 30min reconnection window
  const opponentPlayer = players.find((p) => p.id === myOpponentId);

  // Debug logging for opponent data
  console.log('🔍 DEBUG - Combat Display:', {
    phase,
    mySessionId,
    myOpponentId,
    myOpponentName,
    opponentPlayer: opponentPlayer ? {
      id: opponentPlayer.id,
      username: opponentPlayer.username,
      boardSize: opponentPlayer.board?.length,
      isEliminated: opponentPlayer.isEliminated
    } : null,
    totalPlayers: players.length,
    allPlayerIds: players.map(p => p.id)
  });

  // Merge my board (right side) with opponent's board (left side) for combat display
  const getCombinedBoard = () => {
    type BoardPosition = { row: number; col: number; character?: any };
    const combined: BoardPosition[] = [];

    // Add opponent's units to LEFT side (columns 0-3)
    if (opponentPlayer?.board) {
      opponentPlayer.board.forEach(pos => {
        // Mirror opponent's position: they see their units on right (5-8)
        // We need to show them on our left (0-3)
        // Mapping: opponent's col 5→3, 6→2, 7→1, 8→0
        const mirroredCol = 8 - pos.col;

        combined.push({
          row: pos.row,
          col: mirroredCol,
          character: pos.character
        });
      });
    }

    // Add my units to RIGHT side (columns 5-8) - unchanged
    if (myPlayer?.board) {
      combined.push(...myPlayer.board);
    }

    return combined;
  };

  // Handle cancel game - cancel for ALL players
  const handleCancelGame = () => {
    // Send cancel message to server (will disconnect everyone)
    gameClient.send('cancel_game');
    // Server will broadcast game_cancelled and disconnect all players
  };

  // Handle logout - disconnect and logout
  const handleLogout = async () => {
    await logout();
    // The AuthWrapper will detect we're no longer authenticated and show LoginScreen
  };

  // Listen for level-up and game cancellation messages from server
  useEffect(() => {
    const room = gameClient.getRoom();
    if (!room) return;

    const handleLevelUp = (data: { newLevel: number; message: string }) => {
      setLevelUpModal({
        isOpen: true,
        level: data.newLevel,
        message: data.message
      });
    };

    const handleGameCancelled = (data: { message: string }) => {
      console.log('🚫 Game cancelled:', data.message);
      // Server will disconnect us, GameLobby will auto-reconnect to NEW room
      leaveGame();
    };

    room.onMessage('level_up', handleLevelUp);
    room.onMessage('game_cancelled', handleGameCancelled);

    return () => {
      room.onMessage('level_up', () => {}); // Cleanup
      room.onMessage('game_cancelled', () => {}); // Cleanup
    };
  }, [leaveGame]);

  // Track mouse position for custom cursor
  const handleMouseMove = (e: React.MouseEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  };

  // Handle selecting character from bench
  const handleSelectCharacter = (index: number) => {
    // If clicking the same bench character, deselect it
    if (selectedBenchIndex === index) {
      setSelectedBenchIndex(null);
      setCursorIcon(null);
      return;
    }

    setSelectedBenchIndex(index);
    setSelectedArenaPos(null); // Clear any arena selection

    // Get the character's emoji for the cursor
    const character = myPlayer?.bench[index];
    setCursorIcon(character?.emoji || '⚔️');
  };

  // Handle clicking on empty bench slot to place arena character
  const handleBenchSlotClick = (benchIndex: number) => {
    if (!myPlayer) return;

    // Disable during COMBAT phase
    if (phase === 'COMBAT') {
      return;
    }

    // Only handle if we have an arena character selected
    if (selectedArenaPos) {
      gameClient.send('remove_from_board', {
        row: selectedArenaPos.row,
        col: selectedArenaPos.col,
        targetBenchIndex: benchIndex
      });
      setSelectedArenaPos(null);
      setCursorIcon(null);
    }
  };

  // Handle selling character from bench
  const handleSellCharacter = (benchIndex: number) => {
    if (!myPlayer) return;

    // Clear any selections
    setSelectedBenchIndex(null);
    setSelectedArenaPos(null);
    setCursorIcon(null);

    // Send sell request to server
    gameClient.send('sell_character', { benchIndex });
    console.log(`Selling character at bench index ${benchIndex}`);
  };

  // Handle selling character from arena
  const handleSellArenaCharacter = () => {
    if (!myPlayer || !selectedArenaPos) return;

    // Clear any selections
    const { row, col } = selectedArenaPos;
    setSelectedBenchIndex(null);
    setSelectedArenaPos(null);
    setCursorIcon(null);

    // Send remove from board request to server (which gives gold back)
    gameClient.send('remove_from_board', { row, col });
    console.log(`Selling character from arena at (${row}, ${col})`);
  };

  // Handle swapping/moving characters on bench
  const handleSwapBench = (fromIndex: number, toIndex: number) => {
    if (!myPlayer) return;

    // Allow bench swapping during both PREPARATION and COMBAT phases
    // Clear selections after swap
    setSelectedBenchIndex(null);
    setCursorIcon(null);

    // Send swap request to server
    gameClient.send('swap_bench', { fromIndex, toIndex });
    console.log(`Swapping bench characters: ${fromIndex} <-> ${toIndex}`);
  };

  // Handle clicking arena cell to place character or remove character
  const handleArenaCellClick = (row: number, col: number) => {
    if (!myPlayer) return;

    // During COMBAT phase - disable all arena interactions
    if (phase === 'COMBAT') {
      return;
    }

    // Check if there's already a character at this position
    const existingCharacter = myPlayer.board.find(pos => pos.row === row && pos.col === col);

    // Check if clicking the same selected character (deselect without moving)
    if (existingCharacter && selectedArenaPos &&
        selectedArenaPos.row === row && selectedArenaPos.col === col) {
      // Just deselect, don't remove
      setSelectedArenaPos(null);
      setSelectedBenchIndex(null);
      setCursorIcon(null);
      return;
    }

    if (existingCharacter && selectedArenaPos) {
      // Moving from one arena position to another
      gameClient.send('move_on_board', {
        fromRow: selectedArenaPos.row,
        fromCol: selectedArenaPos.col,
        toRow: row,
        toCol: col
      });
      setSelectedArenaPos(null);
      setSelectedBenchIndex(null);
      setCursorIcon(null);
    } else if (existingCharacter && !selectedBenchIndex && !selectedArenaPos) {
      // Select this arena character for moving
      setSelectedArenaPos({ row, col });
      setSelectedBenchIndex(null);
      // Get the character's emoji for the cursor
      setCursorIcon(existingCharacter.character?.emoji || '⚔️');
    } else if (selectedArenaPos && !existingCharacter) {
      // Move selected arena character to empty cell
      gameClient.send('move_on_board', {
        fromRow: selectedArenaPos.row,
        fromCol: selectedArenaPos.col,
        toRow: row,
        toCol: col
      });
      setSelectedArenaPos(null);
      setCursorIcon(null);
    } else if (selectedBenchIndex !== null && !existingCharacter) {
      // Place character from bench to board
      gameClient.send('place_character', {
        benchIndex: selectedBenchIndex,
        row,
        col
      });
      setSelectedBenchIndex(null);
      setCursorIcon(null);
    }
  };

  if (!myPlayer) {
    return (
      <Box minH="100vh" bgGradient="linear(135deg, #1a1a2e 0%, #16213e 100%)" color="white" p={4}>
        <Text>Loading player data...</Text>
      </Box>
    );
  }

  return (
    <Box
      minH="100vh"
      bgGradient="linear(135deg, #1a1a2e 0%, #16213e 100%)"
      color="white"
      p={4}
      onMouseMove={handleMouseMove}
      cursor={cursorIcon ? 'none' : 'default'}
    >
      {/* Custom cursor with character icon */}
      {cursorIcon && (
        <Box
          position="fixed"
          left={`${cursorPos.x}px`}
          top={`${cursorPos.y}px`}
          fontSize="2xl"
          pointerEvents="none"
          zIndex={9999}
          transform="translate(-50%, -50%)"
        >
          {cursorIcon}
        </Box>
      )}

      {/* Stats and Game Info - Top Row */}
      <HStack maxW="1400px" mx="auto" mb={2} justifyContent="space-between" alignItems="flex-start">
        {/* Player Stats - Compact */}
        <HStack gap={2}>
          <Box bg="rgba(255, 0, 0, 0.2)" px={3} py={2} borderRadius="md" border="1px solid #ff4444">
            <Text fontSize="sm" color="#ff4444" fontWeight="bold">
              ❤️ {myPlayer.hp}
            </Text>
          </Box>
          <Box bg="rgba(138, 43, 226, 0.2)" px={3} py={2} borderRadius="md" border="1px solid #8a2be2">
            <Text fontSize="sm" color="#8a2be2" fontWeight="bold">
              ⭐ {myPlayer.level}
            </Text>
          </Box>
          <Box bg="rgba(0, 191, 255, 0.2)" px={3} py={2} borderRadius="md" border="1px solid #00bfff">
            <Text fontSize="sm" color="#00bfff" fontWeight="bold">
              📊 XP: {myPlayer.xp}
              {myPlayer.level < PLAYER_CONFIG.MAX_LEVEL ? (
                <Text as="span" fontSize="xs" color="#88d8ff" ml={2}>
                  ({(LEVEL_UP_XP as any)[myPlayer.level + 1] - myPlayer.xp} to lvl {myPlayer.level + 1})
                </Text>
              ) : (
                <Text as="span" fontSize="xs" color="#88d8ff" ml={2}>
                  (MAX)
                </Text>
              )}
            </Text>
          </Box>
        </HStack>

        {/* Game Phase Info */}
        <HStack gap={2}>
          <Box bg="rgba(255, 255, 255, 0.1)" px={3} py={2} borderRadius="md">
            <Text fontSize="sm" fontWeight="bold">
              Round {roundNumber}
            </Text>
          </Box>
          <Box bg="rgba(0, 212, 255, 0.2)" px={3} py={2} borderRadius="md" border="1px solid #00d4ff">
            <Text fontSize="sm" color="#00d4ff" fontWeight="bold">
              ⏱️ {timer}s
            </Text>
          </Box>
          <Box
            bg={phase === 'PREPARATION' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)'}
            px={3}
            py={2}
            borderRadius="md"
            border={`1px solid ${phase === 'PREPARATION' ? '#00ff00' : '#ff0000'}`}
          >
            <Text fontSize="sm" color={phase === 'PREPARATION' ? '#00ff00' : '#ff0000'} fontWeight="bold">
              {phase}
            </Text>
          </Box>
        </HStack>

        {/* Debug Controls - Horizontal */}
        <HStack gap={1}>
          <button
            onClick={() => gameClient.send('debug_toggle_timer')}
            style={{
              background: 'rgba(255, 165, 0, 0.2)',
              border: '1px solid #ffa500',
              color: '#ffa500',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}
          >
            ⏯️
          </button>
          <button
            onClick={() => gameClient.send('debug_next_round')}
            style={{
              background: 'rgba(0, 255, 127, 0.2)',
              border: '1px solid #00ff7f',
              color: '#00ff7f',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}
          >
            ⏭️
          </button>
          <button
            onClick={() => gameClient.send('debug_reset_game')}
            style={{
              background: 'rgba(255, 0, 0, 0.2)',
              border: '1px solid #ff0000',
              color: '#ff0000',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}
          >
            🔄
          </button>
          <button
            onClick={handleCancelGame}
            style={{
              background: 'rgba(255, 255, 0, 0.2)',
              border: '1px solid #ffff00',
              color: '#ffff00',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}
          >
            🏠
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: 'rgba(255, 0, 255, 0.2)',
              border: '1px solid #ff00ff',
              color: '#ff00ff',
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}
          >
            🚪
          </button>
        </HStack>
      </HStack>

      {/* Main Game Area - Arena, Bench, and Shop stacked vertically */}
      <VStack gap={2} maxW="1400px" mx="auto" alignItems="center">
        {/* Team Size Indicator */}
        <Box
          bg={
            selectedBenchIndex !== null
              ? myPlayer.board.length >= myPlayer.level
                ? 'rgba(255, 0, 0, 0.3)'
                : 'rgba(0, 255, 0, 0.3)'
              : 'rgba(255, 255, 255, 0.1)'
          }
          px={4}
          py={2}
          borderRadius="md"
          border={
            selectedBenchIndex !== null
              ? myPlayer.board.length >= myPlayer.level
                ? '2px solid #ff0000'
                : '2px solid #00ff00'
              : '1px solid rgba(255, 255, 255, 0.3)'
          }
        >
          <Text
            fontSize="sm"
            fontWeight="bold"
            color={
              selectedBenchIndex !== null
                ? myPlayer.board.length >= myPlayer.level
                  ? '#ff6666'
                  : '#66ff66'
                : 'white'
            }
          >
            Units: {myPlayer.board.length}/{myPlayer.level}
          </Text>
        </Box>

        {/* Combat Opponent Display */}
        {phase === 'COMBAT' && myOpponentName && (
          <Box textAlign="center" mb={2}>
            <Text fontSize="lg" fontWeight="bold" color="red.400">
              ⚔️ Fighting: {myOpponentName}
              {opponentPlayer && !opponentPlayer.isEliminated && (
                <Text as="span" fontSize="sm" color="gray.400" ml={2}>
                  (Active)
                </Text>
              )}
            </Text>
            {/* Show warning if opponent data is missing (shouldn't happen) */}
            {!opponentPlayer && (
              <Text fontSize="sm" color="yellow.400" mt={1}>
                ⚠️ Opponent disconnected - arena may not be visible
              </Text>
            )}
          </Box>
        )}

        {/* Arena */}
        <Arena
          boardPositions={phase === 'COMBAT' ? getCombinedBoard() : (myPlayer.board || [])}
          selectedArenaPos={selectedArenaPos}
          onCellClick={handleArenaCellClick}
        />

        {/* Bench */}
        <Bench
          characters={myPlayer.bench}
          playerGold={myPlayer.gold}
          selectedBenchIndex={selectedBenchIndex}
          onSelectCharacter={handleSelectCharacter}
          onBenchSlotClick={handleBenchSlotClick}
          onSellCharacter={handleSellCharacter}
          onSwapBench={handleSwapBench}
        />

        {/* Shop */}
        <Shop
          characters={myPlayer.shopCharacterIds.map(id =>
            allCharacters.find(c => c.id === id)!
          )}
          playerGold={myPlayer.gold}
          playerLevel={myPlayer.level}
          phase={phase}
          selectedBenchIndex={selectedBenchIndex}
          benchCharacters={myPlayer.bench as any}
          selectedArenaPos={selectedArenaPos}
          arenaCharacters={(() => {
            const boardArray = new Array(56).fill(null);
            myPlayer.board.forEach(pos => {
              const index = pos.row * 7 + pos.col;
              boardArray[index] = pos.character;
            });
            return boardArray;
          })()}
          onBuy={(characterId) => {
            console.log('Buying character:', characterId);
          }}
          onSellSelectedCharacter={() => {
            if (selectedBenchIndex !== null) {
              handleSellCharacter(selectedBenchIndex);
            }
          }}
          onSellArenaCharacter={handleSellArenaCharacter}
        />
      </VStack>

      {/* Level Up Modal */}
      {levelUpModal.isOpen ? (
        <>
          {/* Backdrop */}
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="rgba(0, 0, 0, 0.7)"
            backdropFilter="blur(10px)"
            zIndex={1000}
            onClick={() => setLevelUpModal({ ...levelUpModal, isOpen: false })}
          />

          {/* Modal */}
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
            borderColor="#8a2be2"
            borderWidth="2px"
            borderRadius="15px"
            maxW="500px"
            w="90%"
            p={8}
            zIndex={1001}
            boxShadow="0 8px 32px rgba(138, 43, 226, 0.5)"
          >
            {/* Close button */}
            <Box
              position="absolute"
              top={4}
              right={4}
              cursor="pointer"
              onClick={() => setLevelUpModal({ ...levelUpModal, isOpen: false })}
              color="white"
              fontSize="xl"
              _hover={{ color: '#8a2be2' }}
            >
              ✕
            </Box>

            {/* Header */}
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color="#8a2be2"
              textAlign="center"
              mb={6}
            >
              🎉 Level Up! 🎉
            </Text>

            {/* Body */}
            <VStack gap={3}>
              <Text color="white" fontSize="xl" fontWeight="bold" textAlign="center">
                You reached Level {levelUpModal.level}!
              </Text>
              <Text color="#88d8ff" fontSize="md" textAlign="center">
                {levelUpModal.message}
              </Text>
            </VStack>

            {/* Footer */}
            <Box display="flex" justifyContent="center" mt={6}>
              <Button
                bg="linear-gradient(135deg, #8a2be2 0%, #6a1bb2 100%)"
                color="white"
                onClick={() => setLevelUpModal({ ...levelUpModal, isOpen: false })}
                size="lg"
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 30px rgba(138, 43, 226, 0.6)',
                }}
              >
                Got it!
              </Button>
            </Box>
          </Box>
        </>
      ) : null}
    </Box>
  );
}
