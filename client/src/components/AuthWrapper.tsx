import { useState, useEffect } from 'react';
import { Spinner, Center, Box } from '@chakra-ui/react';
import { LoginScreen } from './LoginScreen';
import { RegisterScreen } from './RegisterScreen';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { GameLobby } from './GameLobby';
import { useGameStore } from '../store/gameStore';

type AuthView = 'login' | 'register';

export function AuthWrapper() {
  const [currentView, setCurrentView] = useState<AuthView>('login');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  const isAuthenticated = useGameStore((state) => state.isAuthenticated);
  const verifyRefreshToken = useGameStore((state) => state.verifyRefreshToken);

  // Check for refresh token on mount (auto-login)
  useEffect(() => {
    const checkRefreshToken = async () => {
      try {
        await verifyRefreshToken();
      } catch (error) {
        console.error('Token verification failed:', error);
      } finally {
        setIsVerifying(false);
      }
    };

    checkRefreshToken();
  }, [verifyRefreshToken]);

  // Show loading spinner while verifying refresh token
  if (isVerifying) {
    return (
      <Center
        minH="100vh"
        bgGradient="linear(135deg, #1a1a2e 0%, #16213e 100%)"
      >
        <Box textAlign="center">
          <Spinner
            size="xl"
            color="#00d4ff"
            thickness="4px"
            speed="0.65s"
            emptyColor="rgba(255, 255, 255, 0.1)"
          />
        </Box>
      </Center>
    );
  }

  // If authenticated, show game lobby
  if (isAuthenticated) {
    return <GameLobby />;
  }

  // Show login or register screen
  return (
    <>
      {currentView === 'login' ? (
        <LoginScreen
          onSwitchToRegister={() => setCurrentView('register')}
          onForgotPassword={() => setIsForgotPasswordOpen(true)}
        />
      ) : (
        <RegisterScreen
          onSwitchToLogin={() => setCurrentView('login')}
        />
      )}

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
      />
    </>
  );
}
