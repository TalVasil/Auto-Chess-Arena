import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { GameLobby } from '../../components/GameLobby';
import { useGameStore } from '../../store/gameStore';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';

// Mock gameClient
vi.mock('../../network/GameClient', () => ({
  gameClient: {
    send: vi.fn(),
  },
}));

// Mock GamePlay component
vi.mock('../../components/GamePlay', () => ({
  GamePlay: () => <div>GamePlay Component</div>,
}));

// Helper to render with ChakraProvider
const renderWithChakra = (component: React.ReactElement) => {
  return render(
    <ChakraProvider value={defaultSystem}>
      {component}
    </ChakraProvider>
  );
};

describe('GameLobby - Connection Behavior Tests', () => {
  beforeEach(() => {
    // Reset store to initial state
    useGameStore.setState({
      connectionStatus: 'disconnected',
      isConnected: false,
      phase: 'WAITING',
      roundNumber: 0,
      timer: 30,
      players: [],
      mySessionId: null,
      roomId: null,
      displayName: 'Test User',
      connectionError: null,
      isAuthenticated: true,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Auto-Connect on Mount', () => {
    it('should call connect when component mounts with disconnected status', async () => {
      // Arrange: Mock connect function
      const mockConnect = vi.fn();
      useGameStore.setState({
        connectionStatus: 'disconnected',
        connect: mockConnect,
      } as any);

      // Act: Render component
      renderWithChakra(<GameLobby />);

      // Assert: connect should be called
      await waitFor(() => {
        expect(mockConnect).toHaveBeenCalledTimes(1);
      });
    });

    it('should NOT call connect when already connected', async () => {
      // Arrange: Mock as already connected
      const mockConnect = vi.fn();
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        connect: mockConnect,
      } as any);

      // Act: Render component
      renderWithChakra(<GameLobby />);

      // Wait a bit to ensure connect is not called
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: connect should NOT be called
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('should NOT call connect when already connecting', async () => {
      // Arrange: Mock as connecting
      const mockConnect = vi.fn();
      useGameStore.setState({
        connectionStatus: 'connecting',
        connect: mockConnect,
      } as any);

      // Act: Render component
      renderWithChakra(<GameLobby />);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: connect should NOT be called
      expect(mockConnect).not.toHaveBeenCalled();
    });
  });

  describe('Reconnection Token Preservation', () => {
    it('should NOT disconnect on component unmount', async () => {
      // Arrange: Mock disconnect function
      const mockDisconnect = vi.fn();
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        disconnect: mockDisconnect,
        connect: vi.fn(),
      } as any);

      // Act: Render and unmount
      const { unmount } = renderWithChakra(<GameLobby />);
      unmount();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Assert: disconnect should NOT be called on unmount
      expect(mockDisconnect).not.toHaveBeenCalled();
    });
  });

  describe('Connection Status Display', () => {
    it('should show connecting state', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connecting',
        isConnected: false,
        connect: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert - The component shows "Connecting to game server..." when not connected
      expect(screen.getByText(/connecting to game server/i)).toBeInTheDocument();
    });

    it('should show connected state in lobby', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'WAITING',
        players: [],
        connect: vi.fn(),
        logout: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should show error state with retry button', () => {
      // Arrange
      const mockConnect = vi.fn();
      useGameStore.setState({
        connectionStatus: 'error',
        isConnected: false,
        connectionError: 'Failed to connect to server',
        connect: mockConnect,
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert
      expect(screen.getByText(/failed to connect/i)).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  describe('Lobby Display', () => {
    it('should show player count', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'WAITING',
        roomId: 'test-room-123',
        players: [
          { id: '1', username: 'Player1', isReady: false } as any,
          { id: '2', username: 'Player2', isReady: true } as any,
        ],
        mySessionId: '1',
        connect: vi.fn(),
        logout: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert
      expect(screen.getByText(/players in lobby: 2\/8/i)).toBeInTheDocument();
    });

    it('should show ready count', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'WAITING',
        players: [
          { id: '1', username: 'Player1', isReady: false } as any,
          { id: '2', username: 'Player2', isReady: true } as any,
          { id: '3', username: 'Player3', isReady: true } as any,
        ],
        mySessionId: '1',
        connect: vi.fn(),
        logout: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert
      expect(screen.getByText(/players ready in lobby: 2/i)).toBeInTheDocument();
    });

    it('should highlight current player with crown', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'WAITING',
        players: [
          { id: 'my-session', username: 'MyPlayer', isReady: false } as any,
          { id: '2', username: 'Player2', isReady: false } as any,
        ],
        mySessionId: 'my-session',
        connect: vi.fn(),
        logout: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert - should show crown emoji for current player
      expect(screen.getByText(/👑.*MyPlayer/)).toBeInTheDocument();
    });

    it('should show ready badge for ready players', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'WAITING',
        players: [
          { id: '1', username: 'Player1', isReady: true } as any,
        ],
        mySessionId: '1',
        connect: vi.fn(),
        logout: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert
      expect(screen.getByText('✓ Ready')).toBeInTheDocument();
    });
  });

  describe('Game Phase Transition', () => {
    it('should show GamePlay component when game starts', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'PREPARATION', // Game has started
        players: [{ id: '1', username: 'Player1', isReady: true } as any],
        mySessionId: '1',
        connect: vi.fn(),
        logout: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert - GamePlay component should be rendered
      expect(screen.getByText('GamePlay Component')).toBeInTheDocument();
      // Lobby header should NOT be visible
      expect(screen.queryByText(/Auto Chess Arena - Lobby/i)).not.toBeInTheDocument();
    });

    it('should show lobby when in WAITING phase', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'WAITING',
        players: [],
        connect: vi.fn(),
        logout: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert - Lobby should be visible
      expect(screen.getByText(/Auto Chess Arena - Lobby/i)).toBeInTheDocument();
      // GamePlay should NOT be rendered
      expect(screen.queryByText('GamePlay Component')).not.toBeInTheDocument();
    });
  });

  describe('Logout Behavior', () => {
    it('should call logout when logout button is clicked', async () => {
      // Arrange
      const mockLogout = vi.fn();
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'WAITING',
        players: [],
        connect: vi.fn(),
        logout: mockLogout,
      } as any);

      // Act
      renderWithChakra(<GameLobby />);
      const logoutButton = screen.getByText('Logout');
      logoutButton.click();

      // Assert
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });
  });

  describe('Room ID Display', () => {
    it('should show room ID when connected', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'WAITING',
        roomId: 'abc-123-xyz',
        players: [],
        connect: vi.fn(),
        logout: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert
      expect(screen.getByText(/Lobby #abc-123-xyz/i)).toBeInTheDocument();
    });

    it('should show placeholder when room ID not available', () => {
      // Arrange
      useGameStore.setState({
        connectionStatus: 'connected',
        isConnected: true,
        phase: 'WAITING',
        roomId: null,
        players: [],
        connect: vi.fn(),
        logout: vi.fn(),
      } as any);

      // Act
      renderWithChakra(<GameLobby />);

      // Assert
      expect(screen.getByText(/Lobby #\.\.\./i)).toBeInTheDocument();
    });
  });
});
