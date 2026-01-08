import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { gameClient, ConnectionStatus } from '../network/GameClient';
import { authService } from '../services/authService';
import type { ICharacter } from '../../../shared/src/types/game.types';

// Character interface matching server schema
export interface Character {
  id: string;
  name: string;
  emoji: string;
  cost: number;
  rarity: string;
  attack: number;
  defense: number;
  hp: number;
  currentHP: number; // Current HP during combat
  stars: number;
}

// Board position interface
export interface BoardPosition {
  row: number;
  col: number;
  character?: Character;
}

// Player interface matching server schema
export interface Player {
  id: string;
  username: string;
  hp: number;
  gold: number;
  xp: number;
  level: number;
  isReady: boolean;
  isEliminated: boolean;
  bench: Character[];
  shopCharacterIds: string[];
  board: BoardPosition[];
}

// Game state interface
export interface GameStoreState {
  // Authentication
  isAuthenticated: boolean;
  userId: number | null;
  username: string | null;
  displayName: string | null;
  accessToken: string | null;
  refreshToken: string | null;

  // Connection
  connectionStatus: ConnectionStatus;
  isConnected: boolean;
  connectionError: string | null;
  isConnecting: boolean; // Flag to prevent double connections

  // Game state (synced from server)
  phase: string;
  roundNumber: number;
  timer: number;
  players: Player[];

  // Local player info
  mySessionId: string | null;
  roomId: string | null;

  // Combat matchup info
  myOpponentId: string | null;
  myOpponentName: string | null;
  currentMatchups: Array<{
    player1Id: string;
    player1Name: string;
    player2Id: string;
    player2Name: string;
  }>;

  // Characters (loaded from API)
  allCharacters: ICharacter[];
  isCharactersLoaded: boolean;

  // Auth actions
  setAuth: (data: {
    userId: number;
    username: string;
    displayName: string;
    token: string;
    refreshToken?: string;
  }) => void;
  logout: () => Promise<void>;
  verifyRefreshToken: () => Promise<boolean>;

  // Game actions
  connect: () => Promise<void>;
  disconnect: () => void;
  leaveGame: () => void;

  // Character actions
  loadCharacters: () => Promise<void>;
}

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      // Authentication state
      isAuthenticated: false,
      userId: null,
      username: null,
      displayName: null,
      accessToken: null,
      refreshToken: null,

      // Connection state
      connectionStatus: 'disconnected',
      isConnected: false,
      connectionError: null,
      isConnecting: false,

      // Game state
      phase: 'WAITING',
      roundNumber: 0,
      timer: 30,
      players: [],
      mySessionId: null,
      roomId: null,

      // Combat matchup state
      myOpponentId: null,
      myOpponentName: null,
      currentMatchups: [],

      // Characters
      allCharacters: [],
      isCharactersLoaded: false,

      // Auth actions
      setAuth: (data) => {
        const currentUserId = get().userId;

        // Check if this is a DIFFERENT user logging in
        if (currentUserId !== null && currentUserId !== data.userId) {
          console.log('🔄 Different user logging in - switching sessions');

          // Disconnect from previous user's game session
          gameClient.disconnect();

          // Clear the PREVIOUS user's session (using old userId)
          gameClient.clearStoredSession();

          // Reset game state for new user
          set({
            mySessionId: null,
            roomId: null,
            players: [],
            phase: 'WAITING',
            roundNumber: 0,
            timer: 30,
          });
        } else if (currentUserId === data.userId) {
          console.log('✅ Same user logging back in - will try to reconnect');
        } else {
          console.log('🆕 First login');
        }

        set({
          isAuthenticated: true,
          userId: data.userId,
          username: data.username,
          displayName: data.displayName,
          accessToken: data.token,
          refreshToken: data.refreshToken || null,
        });
      },

      logout: async () => {
        const { refreshToken } = get();

        // Call logout API if refresh token exists
        if (refreshToken) {
          try {
            await authService.logout(refreshToken);
          } catch (error) {
            console.error('Logout API error:', error);
          }
        }

        // Disconnect from game
        gameClient.disconnect();

        // Clear Colyseus session data from localStorage
        gameClient.clearStoredSession();

        // Clear auth state
        set({
          isAuthenticated: false,
          userId: null,
          username: null,
          displayName: null,
          accessToken: null,
          refreshToken: null,
          connectionStatus: 'disconnected',
          isConnected: false,
          mySessionId: null,
          roomId: null,
          players: [],
        });
      },

      verifyRefreshToken: async () => {
        const { refreshToken } = get();

        if (!refreshToken) {
          return false;
        }

        try {
          const response = await authService.verifyToken(refreshToken);

          if (response.success && response.token && response.user) {
            set({
              isAuthenticated: true,
              userId: response.user.userId,
              username: response.user.username,
              displayName: response.user.displayName,
              accessToken: response.token,
            });
            return true;
          }

          return false;
        } catch (error) {
          console.error('Token verification failed:', error);
          return false;
        }
      },

      // Connect to game server
      connect: async () => {
        // Prevent double connections from React.StrictMode
        if (get().isConnecting) {
          console.log('⚠️ Connection already in progress, skipping duplicate call');
          // Wait for the existing connection to complete
          return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              clearInterval(checkConnection);
              reject(new Error('Connection timeout - waited 10 seconds'));
            }, 10000); // 10 second timeout

            const checkConnection = setInterval(() => {
              const state = get();
              if (!state.isConnecting) {
                clearInterval(checkConnection);
                clearTimeout(timeout);

                // Check if connection succeeded or failed
                if (state.isConnected) {
                  console.log('✅ Duplicate call detected successful connection');
                  resolve();
                } else {
                  console.log('❌ Duplicate call detected connection failure');
                  reject(new Error(state.connectionError || 'Connection failed'));
                }
              }
            }, 100);
          });
        }

        // Set flag to prevent duplicate calls
        set({ isConnecting: true });

        try {
          let { accessToken } = get();

          // Check if we have a saved session to reconnect to
          const savedSession = gameClient.getStoredSession();

          // If we have saved session, try to reconnect (true)
          // If no saved session, join new game (false)
          const shouldReconnect = savedSession !== null;

          // IMPORTANT: If reconnecting, refresh the access token first
          // This ensures we have a valid token even if server was down for >15min
          if (shouldReconnect) {
            console.log('🔄 Reconnecting - refreshing access token first...');
            const tokenRefreshed = await get().verifyRefreshToken();
            if (tokenRefreshed) {
              // Get the NEW access token after refresh
              accessToken = get().accessToken;
              console.log('✅ Access token refreshed successfully');
            } else {
              console.log('⚠️ Failed to refresh token, will try with existing token');
            }
          }

          let room;

          if (shouldReconnect) {
            console.log('🔄 Attempting to reconnect to previous game...');
            // Try to reconnect - if it fails, throw error (don't auto-join new game)
            room = await gameClient.connect(accessToken || undefined, true);
          } else {
            console.log('🆕 Joining new game...');
            room = await gameClient.connect(accessToken || undefined, false);
          }

      // IMPORTANT: Set up message listeners IMMEDIATELY before any other code
      // This ensures we catch messages sent during the onJoin handler

      // Listen for combat matchups - SET UP FIRST!
      room.onMessage('combat_matchups', (data: any) => {
        console.log('⚔️ Combat matchups received:', data);

        const { matchups, roundNumber } = data;
        const mySessionId = get().mySessionId || room.sessionId;

        // Find which matchup I'm in
        const myMatchup = matchups.find(
          (m: any) => m.player1Id === mySessionId || m.player2Id === mySessionId
        );

        if (myMatchup) {
          // Determine who my opponent is
          const opponentId = myMatchup.player1Id === mySessionId
            ? myMatchup.player2Id
            : myMatchup.player1Id;
          const opponentName = myMatchup.player1Id === mySessionId
            ? myMatchup.player2Name
            : myMatchup.player1Name;

          set({
            myOpponentId: opponentId,
            myOpponentName: opponentName,
            currentMatchups: matchups,
          });

          console.log(`🎯 Round ${roundNumber}: I'm fighting ${opponentName} (${opponentId})`);
        } else {
          // I got a BYE round
          console.log(`🛡️ Round ${roundNumber}: I have a BYE round (no opponent)`);
          set({
            myOpponentId: null,
            myOpponentName: null,
            currentMatchups: matchups,
          });
        }
      });

      // Note: Phase changes are now handled automatically via onStateChange
      // Note: Game start is detected via onStateChange when phase becomes PREPARATION

      // Store our session ID and room ID
      set({
        mySessionId: room.sessionId,
        roomId: room.id
      });

      // Listen to connection status changes
      gameClient.onStatusChange((status) => {
        set({
          connectionStatus: status,
          isConnected: status === 'connected',
        });
      });

      // Listen to state changes from server
      room.onStateChange((state) => {
        // Convert Map to Array for easier React rendering
        const playersArray: Player[] = [];
        state.players.forEach((player) => {
          // Convert ArraySchema to regular arrays
          const bench: Character[] = [];
          player.bench?.forEach((char: any) => {
            bench.push({
              id: char.id,
              name: char.name,
              emoji: char.emoji,
              cost: char.cost,
              rarity: char.rarity,
              attack: char.attack,
              defense: char.defense,
              hp: char.hp,
              currentHP: char.currentHP || char.hp, // Current HP or default to max HP
              stars: char.stars,
            });
          });

          const shopCharacterIds: string[] = [];
          player.shopCharacterIds?.forEach((id: string) => {
            shopCharacterIds.push(id);
          });

          const board: BoardPosition[] = [];
          player.board?.forEach((pos: any) => {
            board.push({
              row: pos.row,
              col: pos.col,
              character: pos.character ? {
                id: pos.character.id,
                name: pos.character.name,
                emoji: pos.character.emoji,
                cost: pos.character.cost,
                rarity: pos.character.rarity,
                attack: pos.character.attack,
                defense: pos.character.defense,
                hp: pos.character.hp,
                currentHP: pos.character.currentHP ?? pos.character.hp, // Current HP or default to max HP
                stars: pos.character.stars,
              } : undefined,
            });
          });

          playersArray.push({
            id: player.id,
            username: player.username,
            hp: player.hp,
            gold: player.gold,
            xp: player.xp,
            level: player.level,
            isReady: player.isReady,
            isEliminated: player.isEliminated,
            bench,
            shopCharacterIds,
            board,
          });
        });

        // Build state updates
        const updates: any = {
          phase: state.phase,
          roundNumber: state.roundNumber,
          timer: state.timer,
          players: playersArray,
        };

        // Clear opponent data ONLY when returning to PREPARATION phase
        // Don't touch opponent data during COMBAT - it's set by combat_matchups message
        if (state.phase === 'PREPARATION') {
          updates.myOpponentId = null;
          updates.myOpponentName = null;
        }
        // Don't include opponent fields in updates during COMBAT phase
        // This prevents onStateChange from overwriting values set by combat_matchups

        set(updates);
      });

      console.log('✅ Game store connected to server');

      // Clear connecting flag on success
      set({ isConnecting: false });
    } catch (error: any) {
      console.error('❌ Failed to connect game store:', error);

      // Extract error message
      let errorMessage = 'Failed to connect. Please make sure the server is running.';
      if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      set({
        connectionStatus: 'error',
        isConnected: false,
        connectionError: errorMessage,
        isConnecting: false, // Clear connecting flag on error
      });
    }
  },

      // Disconnect from server
      disconnect: () => {
        gameClient.disconnect();
        set({
          connectionStatus: 'disconnected',
          isConnected: false,
          isConnecting: false,
          mySessionId: null,
          roomId: null,
          players: [],
          myOpponentId: null,
          myOpponentName: null,
          currentMatchups: [],
        });
      },

      // Leave game intentionally - clears session so you don't auto-reconnect
      leaveGame: () => {
        gameClient.disconnect();
        gameClient.clearStoredSession(); // Clear reconnection token
        set({
          connectionStatus: 'disconnected',
          isConnected: false,
          isConnecting: false,
          mySessionId: null,
          roomId: null,
          players: [],
          myOpponentId: null,
          myOpponentName: null,
          currentMatchups: [],
          phase: 'WAITING',
          roundNumber: 0,
          timer: 30,
        });
      },

      // Load characters from API
      loadCharacters: async () => {
        try {
          const response = await fetch('http://localhost:2567/api/characters');
          const data = await response.json();
          set({
            allCharacters: data.characters,
            isCharactersLoaded: true
          });
          console.log('✅ Loaded characters from API:', data.characters.length);
        } catch (error) {
          console.error('❌ Failed to load characters:', error);
        }
      },
    }),
    {
      name: 'auto-chess-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userId: state.userId,
        username: state.username,
        displayName: state.displayName,
      }),
    }
  )
);
