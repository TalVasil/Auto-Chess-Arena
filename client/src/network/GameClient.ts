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

  constructor() {
    const serverUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:2567';
    this.client = new Client(serverUrl);
    console.log('🎮 GameClient initialized, server:', serverUrl);
  }

  // Connect to the game room
  async connect(token?: string): Promise<Room<GameState>> {
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
      console.log('🔌 Connecting to auto_chess room...');

      // Send JWT token in connection options
      const options = token ? { token } : {};
      this.room = await this.client.joinOrCreate<GameState>('auto_chess', options);

      this.setStatus('connected');
      console.log('✅ Connected to room:', this.room.id);

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
      this.room.leave();
      this.room = null;
      this.setStatus('disconnected');
    }
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
}

// Singleton instance
export const gameClient = new GameClient();