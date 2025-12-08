import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGameStore } from '../../store/gameStore';
import { gameClient } from '../../network/GameClient';

// Mock gameClient
vi.mock('../../network/GameClient', () => ({
  gameClient: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getStoredSession: vi.fn(),
    onStatusChange: vi.fn((callback) => {
      // Immediately call with 'connected' status
      callback('connected');
      return () => {}; // Return unsubscribe function
    }),
  },
}));

// Mock authService
vi.mock('../../services/authService', () => ({
  authService: {
    logout: vi.fn().mockResolvedValue(undefined),
    verifyToken: vi.fn(),
  },
}));

describe('GameStore - Connection Lock Tests', () => {
  beforeEach(() => {
    // Reset store to initial state
    useGameStore.setState({
      isConnecting: false,
      connectionStatus: 'disconnected',
      isConnected: false,
      accessToken: 'test-token',
      mySessionId: null,
      roomId: null,
      players: [],
    });

    // Clear all mocks
    vi.clearAllMocks();

    // Mock successful connection
    (gameClient.connect as any).mockResolvedValue({
      id: 'test-room-id',
      sessionId: 'test-session-id',
      onStateChange: vi.fn(),
      onMessage: vi.fn(),
    });

    (gameClient.getStoredSession as any).mockReturnValue(null);
  });

  describe('Connection Lock Mechanism', () => {
    it('should prevent duplicate connections from React.StrictMode', async () => {
      // Arrange: Get the connect function
      const { connect } = useGameStore.getState();

      // Act: Simulate React.StrictMode double execution
      const promise1 = connect();
      const promise2 = connect();

      // Wait for both to complete
      await Promise.all([promise1, promise2]);

      // Assert: gameClient.connect should only be called once
      expect(gameClient.connect).toHaveBeenCalledTimes(1);
    });

    it('should set isConnecting flag when connection starts', async () => {
      // Arrange: Mock connect to delay so we can check flag
      let resolveConnect: any;
      (gameClient.connect as any).mockReturnValue(
        new Promise((resolve) => {
          resolveConnect = resolve;
        })
      );

      // Act: Start connection
      const { connect } = useGameStore.getState();
      const connectPromise = connect();

      // Assert: Flag should be set
      expect(useGameStore.getState().isConnecting).toBe(true);

      // Resolve the connection
      resolveConnect({
        id: 'test-room-id',
        sessionId: 'test-session-id',
        onStateChange: vi.fn(),
        onMessage: vi.fn(),
      });

      await connectPromise;

      // Assert: Flag should be cleared
      expect(useGameStore.getState().isConnecting).toBe(false);
    });

    it('should clear isConnecting flag on connection error', async () => {
      // Arrange: Mock connect to fail
      (gameClient.connect as any).mockRejectedValue(new Error('Connection failed'));

      // Act: Try to connect
      const { connect } = useGameStore.getState();
      try {
        await connect();
      } catch (error) {
        // Expected
      }

      // Assert: Flag should be cleared
      expect(useGameStore.getState().isConnecting).toBe(false);
      expect(useGameStore.getState().connectionStatus).toBe('error');
    });

    it('should wait for existing connection to complete when called twice', async () => {
      // Arrange: Mock connect with delay
      let resolveConnect: any;
      (gameClient.connect as any).mockReturnValue(
        new Promise((resolve) => {
          setTimeout(() => {
            resolveConnect = resolve;
            resolve({
              id: 'test-room-id',
              sessionId: 'test-session-id',
              onStateChange: vi.fn(),
              onMessage: vi.fn(),
            });
          }, 100);
        })
      );

      // Act: Call connect twice
      const { connect } = useGameStore.getState();
      const promise1 = connect();
      const promise2 = connect();

      // Wait for both
      await Promise.all([promise1, promise2]);

      // Assert: Only one actual connection attempt
      expect(gameClient.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection when saved session exists', async () => {
      // Arrange: Mock saved session
      (gameClient.getStoredSession as any).mockReturnValue('saved-token');

      // Act: Connect
      const { connect } = useGameStore.getState();
      await connect();

      // Assert: Should call connect with tryReconnect=true
      expect(gameClient.connect).toHaveBeenCalledWith('test-token', true);
    });

    it('should join new game when no saved session exists', async () => {
      // Arrange: Mock no saved session
      (gameClient.getStoredSession as any).mockReturnValue(null);

      // Act: Connect
      const { connect } = useGameStore.getState();
      await connect();

      // Assert: Should call connect with tryReconnect=false
      expect(gameClient.connect).toHaveBeenCalledWith('test-token', false);
    });

    it('should fallback to new game if reconnection fails', async () => {
      // Arrange: Mock saved session and failed reconnection
      (gameClient.getStoredSession as any).mockReturnValue('expired-token');

      let callCount = 0;
      (gameClient.connect as any).mockImplementation((token, tryReconnect) => {
        callCount++;
        if (callCount === 1 && tryReconnect) {
          // First call with reconnect=true fails
          return Promise.reject(new Error('Reconnection failed'));
        }
        // Second call with reconnect=false succeeds
        return Promise.resolve({
          id: 'new-room-id',
          sessionId: 'new-session-id',
          onStateChange: vi.fn(),
          onMessage: vi.fn(),
        });
      });

      // Act: Connect
      const { connect } = useGameStore.getState();
      await connect();

      // Assert: Should have called connect twice
      expect(gameClient.connect).toHaveBeenCalledTimes(2);
      expect(gameClient.connect).toHaveBeenNthCalledWith(1, 'test-token', true); // Reconnect attempt
      expect(gameClient.connect).toHaveBeenNthCalledWith(2, 'test-token', false); // New game
    });
  });

  describe('Session Storage', () => {
    it('should store session ID and room ID after connection', async () => {
      // Act: Connect
      const { connect } = useGameStore.getState();
      await connect();

      // Assert: Session data should be stored
      const state = useGameStore.getState();
      expect(state.mySessionId).toBe('test-session-id');
      expect(state.roomId).toBe('test-room-id');
    });

    it('should clear session data on disconnect', () => {
      // Arrange: Set session data
      useGameStore.setState({
        mySessionId: 'test-session-id',
        roomId: 'test-room-id',
        connectionStatus: 'connected',
        isConnected: true,
        players: [{ id: 'test', username: 'Test', hp: 100 } as any],
      });

      // Act: Disconnect
      const { disconnect } = useGameStore.getState();
      disconnect();

      // Assert: Session data should be cleared
      const state = useGameStore.getState();
      expect(state.mySessionId).toBeNull();
      expect(state.roomId).toBeNull();
      expect(state.players).toEqual([]);
      expect(state.connectionStatus).toBe('disconnected');
      expect(state.isConnected).toBe(false);
    });
  });

  describe('Authentication', () => {
    it('should set auth data correctly', () => {
      // Act: Set auth
      const { setAuth } = useGameStore.getState();
      setAuth({
        userId: 123,
        username: 'testuser',
        displayName: 'Test User',
        token: 'jwt-token',
        refreshToken: 'refresh-token',
      });

      // Assert: Auth data should be stored
      const state = useGameStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.userId).toBe(123);
      expect(state.username).toBe('testuser');
      expect(state.displayName).toBe('Test User');
      expect(state.accessToken).toBe('jwt-token');
      expect(state.refreshToken).toBe('refresh-token');
    });

    it('should clear auth data on logout', async () => {
      // Arrange: Set auth data
      useGameStore.setState({
        isAuthenticated: true,
        userId: 123,
        username: 'testuser',
        displayName: 'Test User',
        accessToken: 'jwt-token',
        refreshToken: 'refresh-token',
      });

      // Act: Logout
      const { logout } = useGameStore.getState();
      await logout();

      // Assert: Auth data should be cleared
      const state = useGameStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.userId).toBeNull();
      expect(state.username).toBeNull();
      expect(state.displayName).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
    });

    it('should disconnect game client on logout', async () => {
      // Act: Logout
      const { logout } = useGameStore.getState();
      await logout();

      // Assert: disconnect should be called
      expect(gameClient.disconnect).toHaveBeenCalled();
    });
  });

  describe('Connection Status', () => {
    it('should update connection status from gameClient', async () => {
      // Arrange: Mock status change callback
      let statusCallback: any;
      (gameClient.onStatusChange as any).mockImplementation((callback: any) => {
        statusCallback = callback;
        return () => {};
      });

      // Act: Connect
      const { connect } = useGameStore.getState();
      await connect();

      // Simulate status change
      statusCallback('connected');

      // Assert: Status should be updated
      const state = useGameStore.getState();
      expect(state.connectionStatus).toBe('connected');
      expect(state.isConnected).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should set error state on connection failure', async () => {
      // Arrange: Mock connection failure
      (gameClient.connect as any).mockRejectedValue(new Error('Server not available'));

      // Act: Try to connect
      const { connect } = useGameStore.getState();
      await connect();

      // Assert: Error state should be set
      const state = useGameStore.getState();
      expect(state.connectionStatus).toBe('error');
      expect(state.isConnected).toBe(false);
      expect(state.connectionError).toBeTruthy();
    });

    it('should extract error message from Error object', async () => {
      // Arrange: Mock with specific error
      (gameClient.connect as any).mockRejectedValue(new Error('Custom error message'));

      // Act: Try to connect
      const { connect } = useGameStore.getState();
      await connect();

      // Assert: Error message should be extracted
      const state = useGameStore.getState();
      expect(state.connectionError).toContain('Custom error message');
    });
  });
});
