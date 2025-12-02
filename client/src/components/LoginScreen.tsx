import { useState } from 'react';
import {
  Box,
  Button,
  Input,
  VStack,
  Heading,
  Text,
  Link,
  HStack,
} from '@chakra-ui/react';
import { Field } from '@chakra-ui/react/field';
import { useGameStore } from '../store/gameStore';
import { authService } from '../services/authService';

interface LoginScreenProps {
  onSwitchToRegister: () => void;
  onForgotPassword: () => void;
}

export function LoginScreen({ onSwitchToRegister, onForgotPassword }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({ username: '', password: '' });

  const setAuth = useGameStore((state) => state.setAuth);

  const validateForm = (): boolean => {
    const newErrors = { username: '', password: '' };
    let isValid = true;

    if (!username.trim()) {
      newErrors.username = 'Username is required';
      isValid = false;
    } else if (username.length < 3 || username.length > 20) {
      newErrors.username = 'Username must be 3-20 characters';
      isValid = false;
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 8 || password.length > 20) {
      newErrors.password = 'Password must be 8-20 characters';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const response = await authService.login(username, password, rememberMe);

      if (!response.success || !response.token || !response.user) {
        alert('Login Failed: ' + (response.error || 'Invalid username or password'));
        return;
      }

      // Store auth in game store
      setAuth({
        userId: response.user.userId,
        username: response.user.username,
        displayName: response.user.displayName,
        token: response.token,
        refreshToken: response.refreshToken,
      });
    } catch (error) {
      console.error('Login error:', error);
      alert('Connection Error: Could not connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Box
      minH="100vh"
      bgGradient="linear(135deg, #1a1a2e 0%, #16213e 100%)"
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        maxW="420px"
        w="100%"
        bg="rgba(255, 255, 255, 0.05)"
        borderColor="rgba(0, 212, 255, 0.3)"
        borderWidth="2px"
        borderRadius="15px"
        p={8}
        boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
      >
        {/* Header */}
        <VStack spacing={2} mb={8}>
          <Heading
            size="2xl"
            bgGradient="linear(to-r, #00d4ff, #7b68ee)"
            bgClip="text"
            textAlign="center"
          >
            Auto Chess Arena
          </Heading>
          <Text fontSize="lg" color="gray.400" textAlign="center">
            Login to your account
          </Text>
        </VStack>

        {/* Login Form */}
        <VStack spacing={5}>
          <Field.Root invalid={!!errors.username}>
            <Field.Label color="white">Username</Field.Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your username"
              size="lg"
              bg="rgba(0, 0, 0, 0.3)"
              borderColor="rgba(255, 255, 255, 0.2)"
              color="white"
              _hover={{ borderColor: 'rgba(0, 212, 255, 0.5)' }}
              _focus={{ borderColor: '#00d4ff', boxShadow: '0 0 0 1px #00d4ff' }}
            />
            {errors.username && (
              <Field.ErrorText>{errors.username}</Field.ErrorText>
            )}
          </Field.Root>

          <Field.Root invalid={!!errors.password}>
            <Field.Label color="white">Password</Field.Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your password"
              size="lg"
              bg="rgba(0, 0, 0, 0.3)"
              borderColor="rgba(255, 255, 255, 0.2)"
              color="white"
              _hover={{ borderColor: 'rgba(0, 212, 255, 0.5)' }}
              _focus={{ borderColor: '#00d4ff', boxShadow: '0 0 0 1px #00d4ff' }}
            />
            {errors.password && (
              <Field.ErrorText>{errors.password}</Field.ErrorText>
            )}
          </Field.Root>

          {/* Remember Me & Forgot Password */}
          <HStack w="100%" justifyContent="space-between">
            <HStack gap={2}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <Text color="white" fontSize="sm">
                Remember me
              </Text>
            </HStack>
            <Link
              color="#00d4ff"
              fontSize="sm"
              onClick={onForgotPassword}
              _hover={{ textDecoration: 'underline', cursor: 'pointer' }}
            >
              Forgot password?
            </Link>
          </HStack>

          {/* Login Button */}
          <Button
            w="100%"
            size="lg"
            bgGradient="linear(to-r, #00d4ff, #7b68ee)"
            color="white"
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 30px rgba(0, 212, 255, 0.6)',
            }}
            _active={{ transform: 'translateY(0)' }}
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </Button>

          {/* Register Link */}
          <HStack spacing={2}>
            <Text color="gray.400">Don't have an account?</Text>
            <Link
              color="#00d4ff"
              fontWeight="bold"
              onClick={onSwitchToRegister}
              _hover={{ textDecoration: 'underline', cursor: 'pointer' }}
            >
              Create Account
            </Link>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
