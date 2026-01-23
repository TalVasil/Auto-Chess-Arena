import { useEffect, useState } from 'react';
import { Box, Heading, Text, Badge, Button, Grid, VStack, HStack } from '@chakra-ui/react';
import { useGameStore } from '../store/gameStore';
import { gameClient } from '../network/GameClient';
import { GamePlay } from './GamePlay';
import { DebugControls } from './DebugControls';
import styles from './GameLobby.module.css';

export function GameLobby() {
  const {
    connectionStatus,
    isConnected,
    phase,
    roundNumber,
    timer,
    players,
    mySessionId,
    roomId,
    displayName,
    connectionError,
    connect,
    disconnect,
    logout,
  } = useGameStore();

  const [rulesModal, setRulesModal] = useState<{ isOpen: boolean; rules: string[] }>({
    isOpen: false,
    rules: []
  });

  // Auto-connect on mount
  useEffect(() => {
    // Only connect if not already connected or connecting
    if (connectionStatus === 'disconnected') {
      connect();
    }

    // DON'T disconnect on unmount - we want to allow reconnection on page refresh
    // Disconnect only happens when user clicks Logout button
  }, []); // Empty deps - only run once on mount

  // Listen for game rules message
  useEffect(() => {
    const room = gameClient.getRoom();
    if (!room) return;

    const handleGameRules = (data: { rules: string[] }) => {
      console.log('📜 Received game rules');
      setRulesModal({ isOpen: true, rules: data.rules });
    };

    const unsub = room.onMessage('game_rules', handleGameRules);
    return () => unsub();
  }, [isConnected]);

  // Get connection status display
  const getStatusDisplay = () => {
    switch (connectionStatus) {
      case 'connecting':
        return { text: 'Connecting...', color: '#FFA500', icon: '🔄' };
      case 'connected':
        return { text: 'Connected', color: '#00FF00', icon: '✅' };
      case 'error':
        return { text: 'Connection Error', color: '#FF0000', icon: '❌' };
      case 'disconnected':
        return { text: 'Disconnected', color: '#999999', icon: '⚫' };
    }
  };

  const status = getStatusDisplay();

  // Get my player info
  const myPlayer = players.find((p) => p.id === mySessionId);

  return (
    <Box minH="100vh" bgGradient="linear(135deg, #1a1a2e 0%, #16213e 100%)" color="white" p={8}>
      {/* Header - only show in lobby */}
      {phase === 'WAITING' && (
        <VStack spacing={4} mb={8} pb={4} borderBottom="2px solid" borderColor="rgba(0, 212, 255, 0.3)">
          <HStack w="100%" justify="space-between">
            <Box />
            <Heading
              size="2xl"
              bgGradient="linear(to-r, #00d4ff, #7b68ee)"
              bgClip="text"
            >
              Auto Chess Arena - Lobby
            </Heading>
            <HStack spacing={2}>
              <DebugControls phase="WAITING" />
              <Button
                variant="ghost"
                color="red.400"
                _hover={{ bg: 'rgba(255, 0, 0, 0.1)', color: 'red.300' }}
                onClick={logout}
              >
                🚪 Logout
              </Button>
            </HStack>
          </HStack>

          {displayName && (
            <Text fontSize="md" color="gray.400">
              Logged in as: <Text as="span" color="#00d4ff" fontWeight="bold">{displayName}</Text>
            </Text>
          )}

          <HStack spacing={2}>
            <Text fontSize="xl">{status.icon}</Text>
            <Text fontSize="lg" fontWeight="bold" color={status.color}>
              {status.text}
            </Text>
          </HStack>
        </VStack>
      )}

      {isConnected ? (
        phase !== 'WAITING' ? (
          // Game has started - show GamePlay component
          <GamePlay />
        ) : (
          // Still in lobby - show player list and ready button
          <VStack spacing={8} maxW="1200px" mx="auto">
            {/* Players Panel */}
            <Box
            w="100%"
            bg="rgba(255, 255, 255, 0.05)"
            borderColor="rgba(0, 212, 255, 0.3)"
            borderWidth="1px"
            borderRadius="md"
            p={6}
          >
            <VStack align="stretch" spacing={3} mb={4}>
              <Heading size="md" color="#00d4ff">
                Lobby #{roomId || '...'}
              </Heading>
              <Text fontSize="md" color="white">
                Players in lobby: {players.length}/8
              </Text>
              <Text fontSize="md" color="white">
                Players ready in lobby: {players.filter(p => p.isReady).length}
              </Text>
            </VStack>

            {players.length === 0 ? (
              <Text textAlign="center" py={8} color="gray.500" fontStyle="italic">
                Waiting for players...
              </Text>
            ) : (
              <Grid templateColumns="repeat(auto-fill, minmax(250px, 1fr))" gap={4}>
                {players.map((player) => (
                  <Box
                    key={player.id}
                    bg="rgba(255, 255, 255, 0.08)"
                    borderColor={player.id === mySessionId ? "rgba(123, 104, 238, 0.8)" : "rgba(255, 255, 255, 0.1)"}
                    borderWidth="2px"
                    borderRadius="md"
                    p={4}
                    _hover={{ borderColor: "rgba(0, 212, 255, 0.5)", transform: "translateY(-2px)" }}
                    transition="all 0.3s"
                  >
                    <Text fontWeight="bold" fontSize="lg" mb={2}>
                      {player.id === mySessionId && '👑 '}
                      {player.username}
                    </Text>
                    <HStack gap={2}>
                      {player.isReady && (
                        <Badge colorScheme={player.hasAcknowledgedRules ? "green" : "yellow"} variant="solid">
                          {player.hasAcknowledgedRules ? '✓ Ready' : '📖 Reading...'}
                        </Badge>
                      )}
                    </HStack>
                  </Box>
                ))}
              </Grid>
            )}
          </Box>

          {/* Ready Section */}
          {myPlayer && (
            <VStack
              w="100%"
              spacing={4}
              p={8}
              bg="rgba(255, 255, 255, 0.03)"
              borderRadius="15px"
              borderColor="rgba(0, 212, 255, 0.3)"
              borderWidth="1px"
            >
              <Button
                size="lg"
                px={12}
                py={6}
                fontSize="xl"
                bgGradient={myPlayer.isReady
                  ? "linear(to-r, #00ff00, #00aa00)"
                  : "linear(to-r, #00d4ff, #7b68ee)"
                }
                color="white"
                borderRadius="full"
                boxShadow="0 5px 20px rgba(0, 212, 255, 0.4)"
                _hover={{
                  transform: "translateY(-3px)",
                  boxShadow: "0 8px 30px rgba(0, 212, 255, 0.6)"
                }}
                _active={{ transform: "translateY(-1px)" }}
                onClick={() => gameClient.send('ready')}
              >
                {myPlayer.isReady ? '✓ Ready!' : 'Ready Up'}
              </Button>

              <Text fontSize="lg" color="#00d4ff" fontWeight="bold">
                {players.filter(p => p.isReady).length} / 8 players ready
              </Text>
              {players.filter(p => p.isReady).length > 0 && (
                <Text fontSize="sm" color={players.every(p => !p.isReady || p.hasAcknowledgedRules) ? "green.400" : "yellow.400"}>
                  {players.filter(p => p.hasAcknowledgedRules).length} / {players.filter(p => p.isReady).length} confirmed rules
                </Text>
              )}
            </VStack>
          )}
          </VStack>
        )
      ) : (
        <VStack spacing={4} textAlign="center" py={16}>
          <Text fontSize="4xl" className={styles.loadingSpinner}>🔄</Text>
          <Text fontSize="lg">Connecting to game server...</Text>
          {connectionStatus === 'error' && (
            <Box
              mt={8}
              p={6}
              bg="rgba(255, 0, 0, 0.1)"
              borderColor="rgba(255, 0, 0, 0.5)"
              borderWidth="2px"
              borderRadius="10px"
            >
              <Text mb={4}>
                {connectionError || 'Failed to connect. Please make sure the server is running.'}
              </Text>
              <Button
                colorScheme="blue"
                onClick={() => connect()}
              >
                Retry
              </Button>
            </Box>
          )}
        </VStack>
      )}

      {/* Game Rules Modal */}
      {rulesModal.isOpen && (
        <>
          {/* Backdrop */}
          <Box
            position="fixed"
            top={0}
            left={0}
            right={0}
            bottom={0}
            bg="rgba(0, 0, 0, 0.7)"
            zIndex={1000}
          />

          {/* Modal */}
          <Box
            position="fixed"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)"
            border="2px solid #8a2be2"
            borderRadius="20px"
            p={8}
            minW="400px"
            maxW="500px"
            zIndex={1001}
            boxShadow="0 8px 32px rgba(138, 43, 226, 0.5)"
          >
            {/* Header */}
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color="#8a2be2"
              textAlign="center"
              mb={6}
            >
              📜 Game Rules 📜
            </Text>

            {/* Rules List */}
            <VStack align="start" gap={3} mb={6}>
              {rulesModal.rules.map((rule, index) => (
                <Text key={index} color="white" fontSize="md">
                  {rule}
                </Text>
              ))}
            </VStack>

            {/* Footer */}
            <Box display="flex" justifyContent="center">
              <Button
                bg="linear-gradient(135deg, #8a2be2 0%, #6a1bb2 100%)"
                color="white"
                onClick={() => {
                  setRulesModal({ ...rulesModal, isOpen: false });
                  gameClient.send('acknowledge_rules');
                }}
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
      )}
    </Box>
  );
}
