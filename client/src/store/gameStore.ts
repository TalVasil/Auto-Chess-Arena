import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { gameClient, ConnectionStatus } from '../network/GameClient';
import { authService } from '../services/authService';
import type { ICharacter } from '../../../shared/src/types/game.types';

// Character interface matching server schema
export interface Character {
  id: string;
  name: string;
  cost: number;
  rarity: string;
  attack: number;
  defense: number;
  hp: number;
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

      // Auth actions
      setAuth: (data) => {
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
          return new Promise((resolve) => {
            const checkConnection = setInterval(() => {
              const state = get();
              if (!state.isConnecting) {
                clearInterval(checkConnection);
                resolve();
              }
            }, 100);
          });
        }

        // Set flag to prevent duplicate calls
        set({ isConnecting: true });

        try {
          const { accessToken } = get();

          // Check if we have a saved session to reconnect to
          const savedSession = gameClient.getStoredSession();

          // If we have saved session, try to reconnect (true)
          // If no saved session, join new game (false)
          const shouldReconnect = savedSession !== null;

          let room;

          if (shouldReconnect) {
            console.log('🔄 Attempting to reconnect to previous game...');
            try {
              room = await gameClient.connect(accessToken || undefined, true);
            } catch (reconnectError) {
              // Reconnection failed (token expired, server restarted, etc.)
              // The GameClient already cleared the token, so now join a fresh game
              console.log('⚠️ Reconnection failed, joining new game instead...');
              room = await gameClient.connect(accessToken || undefined, false);
            }
          } else {
            console.log('🆕 Joining new game...');
            room = await gameClient.connect(accessToken || undefined, false);
          }

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
              cost: char.cost,
              rarity: char.rarity,
              attack: char.attack,
              defense: char.defense,
              hp: char.hp,
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
                cost: pos.character.cost,
                rarity: pos.character.rarity,
                attack: pos.character.attack,
                defense: pos.character.defense,
                hp: pos.character.hp,
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

        set({
          phase: state.phase,
          roundNumber: state.roundNumber,
          timer: state.timer,
          players: playersArray,
        });
      });

      // Listen for game start message
      room.onMessage('game_started', (message) => {
        console.log('🎮 Game started!', message);
        // The phase change will be picked up by onStateChange
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
        });
      },
    }),
    {
      name: 'auto-chess-storage',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        userId: state.userId,
        username: state.username,
        displayName: state.displayName,
      }),
    }
  )
);
