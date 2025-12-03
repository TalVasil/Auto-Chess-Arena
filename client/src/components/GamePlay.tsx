import { useState } from 'react';
import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import { useGameStore } from '../store/gameStore';
import { Arena } from './Arena';
import { Bench } from './Bench';
import { Shop } from './Shop';
import { CHARACTERS } from '../../../shared/src/constants/characterData';
import { gameClient } from '../network/GameClient';

export function GamePlay() {
  const { phase, roundNumber, timer, players, mySessionId } = useGameStore();
  const [selectedBenchIndex, setSelectedBenchIndex] = useState<number | null>(null);
  const [selectedArenaPos, setSelectedArenaPos] = useState<{row: number, col: number} | null>(null);
  const [cursorIcon, setCursorIcon] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Get my player info
  const myPlayer = players.find((p) => p.id === mySessionId);

  // Track mouse position for custom cursor
  const handleMouseMove = (e: React.MouseEvent) => {
    setCursorPos({ x: e.clientX, y: e.clientY });
  };

  // Handle selecting character from bench
  const handleSelectCharacter = (index: number) => {
    // Disable during COMBAT phase
    if (phase === 'COMBAT') {
      return;
    }

    // If clicking the same bench character, deselect it
    if (selectedBenchIndex === index) {
      setSelectedBenchIndex(null);
      setCursorIcon(null);
      return;
    }

    setSelectedBenchIndex(index);
    setSelectedArenaPos(null); // Clear any arena selection
    setCursorIcon('⚔️'); // Show sword icon on cursor
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

    // Disable during COMBAT phase
    if (phase === 'COMBAT') {
      return;
    }

    // Clear any selections
    setSelectedBenchIndex(null);
    setSelectedArenaPos(null);
    setCursorIcon(null);

    // Send sell request to server
    gameClient.send('sell_character', { benchIndex });
    console.log(`Selling character at bench index ${benchIndex}`);
  };

  // Handle swapping/moving characters on bench
  const handleSwapBench = (fromIndex: number, toIndex: number) => {
    if (!myPlayer) return;

    // Disable during COMBAT phase
    if (phase === 'COMBAT') {
      return;
    }

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

    // Disable during COMBAT phase
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
      setCursorIcon('⚔️'); // Show sword icon on cursor
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

      {/* Debug Controls */}
      <HStack justify="center" mb={2} gap={2}>
        <button
          onClick={() => gameClient.send('debug_toggle_timer')}
          style={{
            background: 'rgba(255, 165, 0, 0.2)',
            border: '2px solid #ffa500',
            color: '#ffa500',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.85rem'
          }}
        >
          ⏯️ Toggle Timer
        </button>
        <button
          onClick={() => gameClient.send('debug_toggle_phase')}
          style={{
            background: 'rgba(138, 43, 226, 0.2)',
            border: '2px solid #8a2be2',
            color: '#8a2be2',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.85rem'
          }}
        >
          🔄 Toggle Phase
        </button>
        <button
          onClick={() => gameClient.send('debug_next_round')}
          style={{
            background: 'rgba(0, 255, 127, 0.2)',
            border: '2px solid #00ff7f',
            color: '#00ff7f',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.85rem'
          }}
        >
          ⏭️ Next Round
        </button>
        <button
          onClick={() => gameClient.send('debug_reset_game')}
          style={{
            background: 'rgba(255, 0, 0, 0.2)',
            border: '2px solid #ff0000',
            color: '#ff0000',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '0.85rem'
          }}
        >
          🔄 Reset Game
        </button>
      </HStack>

      {/* Game Header - Player Stats */}
      <HStack justify="space-between" mb={4} px={4}>
        <HStack gap={4}>
          <Box bg="rgba(255, 0, 0, 0.2)" px={3} py={1} borderRadius="md" border="2px solid #ff4444">
            <Text fontSize="sm" color="#ff4444" fontWeight="bold">
              ❤️ HP: {myPlayer.hp}
            </Text>
          </Box>
          <Box bg="rgba(255, 215, 0, 0.2)" px={3} py={1} borderRadius="md" border="2px solid #ffd700">
            <Text fontSize="sm" color="#ffd700" fontWeight="bold">
              💰 Gold: {myPlayer.gold}
            </Text>
          </Box>
          <Box bg="rgba(138, 43, 226, 0.2)" px={3} py={1} borderRadius="md" border="2px solid #8a2be2">
            <Text fontSize="sm" color="#8a2be2" fontWeight="bold">
              ⭐ Level: {myPlayer.level}
            </Text>
          </Box>
          <Box bg="rgba(0, 191, 255, 0.2)" px={3} py={1} borderRadius="md" border="2px solid #00bfff">
            <Text fontSize="sm" color="#00bfff" fontWeight="bold">
              📊 XP: {myPlayer.xp}
            </Text>
          </Box>
        </HStack>

        <HStack gap={4}>
          <Box bg="rgba(255, 255, 255, 0.1)" px={3} py={1} borderRadius="md">
            <Text fontSize="sm" fontWeight="bold">
              Round {roundNumber}
            </Text>
          </Box>
          <Box bg="rgba(0, 212, 255, 0.2)" px={3} py={1} borderRadius="md" border="2px solid #00d4ff">
            <Text fontSize="sm" color="#00d4ff" fontWeight="bold">
              ⏱️ {timer}s
            </Text>
          </Box>
          <Box
            bg={phase === 'PREPARATION' ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.2)'}
            px={3}
            py={1}
            borderRadius="md"
            border={`2px solid ${phase === 'PREPARATION' ? '#00ff00' : '#ff0000'}`}
          >
            <Text fontSize="sm" color={phase === 'PREPARATION' ? '#00ff00' : '#ff0000'} fontWeight="bold">
              {phase}
            </Text>
          </Box>
        </HStack>
      </HStack>

      {/* Main Game Area */}
      <VStack gap={0} maxW="1400px" mx="auto">
        {/* Arena */}
        <Arena
          boardPositions={myPlayer.board || []}
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
            CHARACTERS.find(c => c.id === id)!
          )}
          playerGold={myPlayer.gold}
          phase={phase}
          onBuy={(characterId) => {
            console.log('Buying character:', characterId);
          }}
        />
      </VStack>
    </Box>
  );
}
