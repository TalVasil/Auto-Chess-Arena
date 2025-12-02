import { useEffect } from 'react';
import { Box, Heading, Text, Badge, Button, Grid, VStack, HStack } from '@chakra-ui/react';
import { useGameStore } from '../store/gameStore';
import { gameClient } from '../network/GameClient';
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

  // Auto-connect on mount
  useEffect(() => {
    // Only connect if not already connected or connecting
    if (connectionStatus === 'disconnected') {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, []); // Empty deps - only run once on mount

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
      {/* Header */}
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
          <Button
            variant="ghost"
            color="red.400"
            _hover={{ bg: 'rgba(255, 0, 0, 0.1)', color: 'red.300' }}
            onClick={logout}
          >
            Logout
          </Button>
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

      {isConnected ? (
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
                    {player.isReady && (
                      <Badge colorScheme="green" variant="solid">
                        ✓ Ready
                      </Badge>
                    )}
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
                {players.filter(p => p.isReady).length} / {players.length} players ready
              </Text>
            </VStack>
          )}
        </VStack>
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
    </Box>
  );
}
