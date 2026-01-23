import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import './Leaderboard.css';

interface Player {
  id: string;
  username: string;
  hp: number;
  isEliminated: boolean;
  isConnected: boolean;
}

interface LeaderboardProps {
  players: Player[];
  mySessionId: string;
}

export function Leaderboard({ players, mySessionId }: LeaderboardProps) {
  // Sort players: alive by HP descending, then eliminated at bottom
  const alivePlayers = players
    .filter(p => !p.isEliminated)
    .sort((a, b) => b.hp - a.hp);

  const eliminatedPlayers = players.filter(p => p.isEliminated);

  const sortedPlayers = [...alivePlayers, ...eliminatedPlayers];

  const getHpColor = (hp: number) => {
    if (hp > 60) return '#00ff00';
    if (hp > 30) return '#ffa500';
    return '#ff4444';
  };

  const getHpBarWidth = (hp: number) => {
    return Math.max(0, Math.min(100, hp));
  };

  return (
    <Box className="leaderboard-container">
      <Box className="leaderboard-header">
        <Text fontSize="md" fontWeight="bold" color="white">
          🏆 Leaderboard
        </Text>
      </Box>

      <VStack gap={1} className="leaderboard-list">
        {sortedPlayers.map((player, index) => {
          const isMe = player.id === mySessionId;
          const rank = player.isEliminated ? null : index + 1;
          const isDisconnected = !player.isConnected;

          return (
            <HStack
              key={player.id}
              className={`leaderboard-row ${isMe ? 'leaderboard-row-me' : ''} ${player.isEliminated ? 'leaderboard-row-eliminated' : ''} ${isDisconnected ? 'leaderboard-row-disconnected' : ''}`}
              justify="space-between"
              w="100%"
            >
              {/* Rank */}
              <Text className="leaderboard-rank" minW="24px">
                {rank !== null ? `${rank}.` : ''}
              </Text>

              {/* Name */}
              <Text
                className={`leaderboard-name ${player.isEliminated ? 'leaderboard-name-eliminated' : ''} ${isDisconnected ? 'leaderboard-name-disconnected' : ''}`}
                flex={1}
                isTruncated
              >
                {player.username}
              </Text>

              {/* HP */}
              {player.isEliminated ? (
                <Text className="leaderboard-hp-eliminated">----</Text>
              ) : (
                <HStack gap={1} minW="70px" justify="flex-end">
                  <Box className="leaderboard-hp-bar-container">
                    <Box
                      className="leaderboard-hp-bar"
                      style={{
                        width: `${getHpBarWidth(player.hp)}%`,
                        backgroundColor: getHpColor(player.hp)
                      }}
                    />
                  </Box>
                  <Text
                    className="leaderboard-hp-text"
                    style={{ color: getHpColor(player.hp) }}
                  >
                    {player.hp}
                  </Text>
                </HStack>
              )}
            </HStack>
          );
        })}
      </VStack>
    </Box>
  );
}
