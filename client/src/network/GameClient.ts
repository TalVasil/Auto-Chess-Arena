import { Client, Room } from 'colyseus.js';

// Types for our game state (matching server schema)
interface Player {
  id: string;
  username: string;
  hp: number;
  gold: number;
  xp: number;
  level: number;
  isReady: boolean;
  isEliminated: boolean;
}

interface GameState {
  phase: string;
  roundNumber: number;
  timer: number;
  players: Map<string, Player>;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

class GameClient {
  private client: Client;
  private room: Room<GameState> | null = null;
  private connectionStatus: ConnectionStatus = 'disconnected';
  private statusListeners: ((status: ConnectionStatus) => void)[] = [];
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor() {
    const serverUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:2567';
    this.client = new Client(serverUrl);
    console.log('🎮 GameClient initialized, server:', serverUrl);
  }

  // Connect to the game room
  async connect(token?: string, tryReconnect: boolean = false): Promise<Room<GameState>> {
    // Prevent double connections
    if (this.room) {
      console.log('⚠️ Already connected to room');
      return this.room;
    }

    if (this.connectionStatus === 'connecting') {
      console.log('⚠️ Already connecting to room');
      throw new Error('Connection already in progress');
    }

    try {
      this.setStatus('connecting');

      // Should we try to reconnect to old game?
      if (tryReconnect) {
        console.log('🔄 Attempting to reconnect to previous game...');

        // Check browser's notebook for saved session
        const saved = this.getStoredSession();

        if (saved) {
          try {
            // Try to reconnect using the reconnection token
            console.log('🔄 Reconnecting with token...');
            this.room = await this.client.reconnect(saved);

            console.log('✅ Reconnected successfully!');
            this.setStatus('connected');

            // IMPORTANT: Save the NEW reconnection token after successful reconnection
            // Colyseus generates a fresh token on each reconnection
            localStorage.setItem('colyseusReconnectionToken', this.room.reconnectionToken);
            console.log('💾 Updated reconnection token after reconnection');

            // Reset reconnection attempts counter on successful reconnection
            this.reconnectAttempts = 0;

            this.setupRoomListeners();
            return this.room;

          } catch (reconnectError) {
            // Reconnection failed - clear old session and throw error
            console.log('❌ Reconnection failed:', reconnectError);
            this.clearStoredSession();
            this.setStatus('error');
            throw new Error('Failed to reconnect to previous game');
          }
        } else {
          // No saved session found when trying to reconnect
          console.log('❌ No saved session found to reconnect');
          this.setStatus('error');
          throw new Error('No saved session found');
        }
      }

      // Not trying to reconnect - join new game
      console.log('🔌 Connecting to new game room...');

      // Send JWT token in connection options
      const options = token ? { token } : {};
      this.room = await this.client.joinOrCreate<GameState>('auto_chess', options);

      // Save reconnection token to localStorage for reconnection
      localStorage.setItem('colyseusReconnectionToken', this.room.reconnectionToken);
      console.log('💾 Saved reconnection token for reconnection:', {
        reconnectionToken: this.room.reconnectionToken,
        roomId: this.room.id
      });

      this.setStatus('connected');
      console.log('✅ Connected to room:', this.room.id);

      // Reset reconnection attempts counter on successful connection
      this.reconnectAttempts = 0;

      this.setupRoomListeners();

      return this.room;
    } catch (error) {
      this.setStatus('error');
      console.error('❌ Failed to connect:', error);
      throw error;
    }
  }

  // Disconnect from the room
  disconnect() {
    if (this.room) {
      console.log('👋 Disconnecting from room');
      this.room.leave(true); // true = consented (intentional)
      this.room = null;
      this.setStatus('disconnected');
    }
  }

  // Attempt to reconnect with exponential backoff
  private attemptReconnect() {
    // Check if we've exceeded max attempts
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Max reconnection attempts reached. Giving up.');
      this.clearStoredSession();
      this.setStatus('error');
      return;
    }

    // Increment attempt counter
    this.reconnectAttempts++;

    // Calculate delay using exponential backoff: 1s, 2s, 4s, 8s, 16s
    // Formula: 2^(attempt - 1) seconds = 1000 * 2^(attempt - 1) milliseconds
    const delayMs = 1000 * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delayMs / 1000}s...`);

    // Wait for the delay, then try to reconnect
    setTimeout(async () => {
      try {
        console.log(`🔄 Attempting reconnection (attempt ${this.reconnectAttempts})...`);
        await this.connect(undefined, true); // true = try to reconnect
        console.log('✅ Automatic reconnection successful!');
      } catch (error) {
        console.log('❌ Automatic reconnection failed:', error);
        // Try again with next backoff delay
        this.attemptReconnect();
      }
    }, delayMs);
  }

  // Get current room
  getRoom(): Room<GameState> | null {
    return this.room;
  }

  // Get connection status
  getStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  // Subscribe to status changes
  onStatusChange(callback: (status: ConnectionStatus) => void) {
    this.statusListeners.push(callback);
    // Immediately call with current status
    callback(this.connectionStatus);

    // Return unsubscribe function
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  // Private: Set status and notify listeners
  private setStatus(status: ConnectionStatus) {
    this.connectionStatus = status;
    this.statusListeners.forEach(callback => callback(status));
  }

  // Private: Setup room event listeners
  private setupRoomListeners() {
    if (!this.room) return;

    this.room.onStateChange((state) => {
      console.log('📊 State changed:', {
        phase: state.phase,
        round: state.roundNumber,
        timer: state.timer,
        playerCount: state.players.size,
      });
    });

    this.room.onMessage('*', (type, message) => {
      console.log('📨 Message received:', type, message);
    });

    this.room.onError((code, message) => {
      console.error('❌ Room error:', code, message);
      this.setStatus('error');
    });

    this.room.onLeave((code) => {
      console.log('👋 Left room, code:', code);

      // Check if disconnect was intentional or accidental
      if (code === 1000) {
        // Code 1000 = Normal close (user clicked logout)
        // This is INTENTIONAL - clear the saved session
        console.log('🚪 Intentional disconnect - clearing session');
        this.clearStoredSession();
      } else {
        // Any other code = Accidental disconnect (browser crash, network error, etc.)
        // Keep the saved session so user can reconnect
        console.log('⚠️ Accidental disconnect - keeping session for reconnection');

        // Automatically attempt to reconnect with exponential backoff
        this.attemptReconnect();
      }

      this.room = null;
      this.setStatus('disconnected');
    });
  }

  // Send a message to the server
  send(type: string, message?: any) {
    if (!this.room) {
      console.warn('⚠️ Cannot send message: not connected');
      return;
    }
    this.room.send(type, message);
  }

  /**
   * Get stored reconnection token from browser memory
   * Returns the reconnectionToken if it exists
   * Returns null if nothing was saved
   */
  getStoredSession(): string | null {
    // Look in browser's notebook for "colyseusReconnectionToken"
    const reconnectionToken = localStorage.getItem('colyseusReconnectionToken');

    // If we found it, return it
    if (reconnectionToken) {
      console.log('📖 Found saved reconnection token');
      return reconnectionToken;
    }

    // If we didn't find it, return null (means "nothing")
    console.log('📖 No saved session found');
    return null;
  }

  /**
   * Clear stored session from browser memory
   * Call this when user logs out intentionally
   */
  clearStoredSession(): void {
    // Delete the saved reconnection token
    localStorage.removeItem('colyseusReconnectionToken');

    console.log('🗑️ Cleared saved session data');
  }
}

// Singleton instance
export const gameClient = new GameClient();