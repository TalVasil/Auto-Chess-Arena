import { useState, useEffect } from 'react';
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

interface RegisterScreenProps {
  onSwitchToLogin: () => void;
}

export function RegisterScreen({ onSwitchToLogin }: RegisterScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    username: '',
    password: '',
    email: '',
    displayName: '',
  });

  const setAuth = useGameStore((state) => state.setAuth);

  // Real-time username availability check
  useEffect(() => {
    if (username.length >= 3 && username.length <= 20) {
      const timer = setTimeout(async () => {
        try {
          const response = await authService.checkUsername(username);
          if (!response.available) {
            setErrors((prev) => ({ ...prev, username: 'Username already taken' }));
          } else {
            setErrors((prev) => ({ ...prev, username: '' }));
          }
        } catch (error) {
          console.error('Username check error:', error);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [username]);

  // Real-time email availability check
  useEffect(() => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailRegex.test(email)) {
      const timer = setTimeout(async () => {
        try {
          const response = await authService.checkEmail(email);
          if (!response.available) {
            setErrors((prev) => ({ ...prev, email: 'Email already registered' }));
          } else {
            setErrors((prev) => ({ ...prev, email: '' }));
          }
        } catch (error) {
          console.error('Email check error:', error);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [email]);

  // Real-time password uniqueness check
  useEffect(() => {
    if (password.length >= 8 && password.length <= 20) {
      const timer = setTimeout(async () => {
        try {
          const response = await authService.checkPassword(password);
          if (!response.available) {
            setErrors((prev) => ({
              ...prev,
              password: 'This password is already in use. Please choose a different one',
            }));
          } else {
            setErrors((prev) => ({ ...prev, password: '' }));
          }
        } catch (error) {
          console.error('Password check error:', error);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [password]);

  const validateForm = (): boolean => {
    // Start with existing errors to preserve real-time validation messages
    const newErrors = { ...errors };
    let isValid = true;

    // Username validation
    if (!username.trim()) {
      newErrors.username = 'Username is required';
      isValid = false;
    } else if (username.length < 3 || username.length > 20) {
      newErrors.username = 'Username must be 3-20 characters';
      isValid = false;
    } else if (!newErrors.username) {
      // Only clear error if there's no existing error (like "Username already taken")
      newErrors.username = '';
    }
    // If there's already an error from real-time check, keep it and mark as invalid
    if (newErrors.username) {
      isValid = false;
    }

    // Password validation
    if (!password.trim()) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 8 || password.length > 20) {
      newErrors.password = 'Password must be 8-20 characters';
      isValid = false;
    } else if (!newErrors.password) {
      // Only clear error if there's no existing error (like "Password already in use")
      newErrors.password = '';
    }
    // If there's already an error from real-time check, keep it and mark as invalid
    if (newErrors.password) {
      isValid = false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!emailRegex.test(email)) {
      newErrors.email = 'Invalid email format';
      isValid = false;
    } else if (!newErrors.email) {
      newErrors.email = '';
    }
    if (newErrors.email) {
      isValid = false;
    }

    // Display name validation
    if (!displayName.trim()) {
      newErrors.displayName = 'Display name is required';
      isValid = false;
    } else {
      newErrors.displayName = '';
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    if (!validateForm()) {
      alert('Validation Error: Please fix the errors in the form before submitting');
      return;
    }

    setIsLoading(true);

    try {
      const response = await authService.register(username, password, email, displayName);

      if (!response.success || !response.token || !response.user) {
        alert('Registration Failed: ' + (response.error || 'Could not create account'));
        return;
      }

      // Store auth in game store
      setAuth({
        userId: response.user.userId,
        username: response.user.username,
        displayName: response.user.displayName,
        token: response.token,
        refreshToken: undefined,
      });
    } catch (error) {
      console.error('Registration error:', error);
      alert('Connection Error: Could not connect to server. Please try again.');
    } finally {
      setIsLoading(false);
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
        maxW="480px"
        w="100%"
        bg="rgba(255, 255, 255, 0.05)"
        borderColor="rgba(0, 212, 255, 0.3)"
        borderWidth="2px"
        borderRadius="15px"
        p={8}
        boxShadow="0 8px 32px rgba(0, 0, 0, 0.3)"
      >
        <VStack spacing={2} mb={6}>
          <Heading
            size="2xl"
            bgGradient="linear(to-r, #00d4ff, #7b68ee)"
            bgClip="text"
            textAlign="center"
          >
            Create Account
          </Heading>
          <Text fontSize="md" color="gray.400" textAlign="center">
            Join Auto Chess Arena
          </Text>
        </VStack>

        <VStack spacing={4}>
          <Field.Root invalid={!!errors.username}>
            <Field.Label color="white">Username (Login)</Field.Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3-20 characters"
              size="lg"
              bg="rgba(0, 0, 0, 0.3)"
              borderColor="rgba(255, 255, 255, 0.2)"
              color="white"
              _hover={{ borderColor: 'rgba(0, 212, 255, 0.5)' }}
              _focus={{ borderColor: '#00d4ff', boxShadow: '0 0 0 1px #00d4ff' }}
            />
            {errors.username ? (
              <Field.ErrorText>{errors.username}</Field.ErrorText>
            ) : (
              <Field.HelperText color="gray.500">Used for logging in (unique)</Field.HelperText>
            )}
          </Field.Root>

          <Field.Root invalid={!!errors.password}>
            <Field.Label color="white">Password</Field.Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8-20 characters"
              size="lg"
              bg="rgba(0, 0, 0, 0.3)"
              borderColor="rgba(255, 255, 255, 0.2)"
              color="white"
              _hover={{ borderColor: 'rgba(0, 212, 255, 0.5)' }}
              _focus={{ borderColor: '#00d4ff', boxShadow: '0 0 0 1px #00d4ff' }}
            />
            {errors.password ? (
              <Field.ErrorText>{errors.password}</Field.ErrorText>
            ) : (
              <Field.HelperText color="gray.500">Must be unique (not used by others)</Field.HelperText>
            )}
          </Field.Root>

          <Field.Root invalid={!!errors.email}>
            <Field.Label color="white">Email</Field.Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              size="lg"
              bg="rgba(0, 0, 0, 0.3)"
              borderColor="rgba(255, 255, 255, 0.2)"
              color="white"
              _hover={{ borderColor: 'rgba(0, 212, 255, 0.5)' }}
              _focus={{ borderColor: '#00d4ff', boxShadow: '0 0 0 1px #00d4ff' }}
            />
            {errors.email ? (
              <Field.ErrorText>{errors.email}</Field.ErrorText>
            ) : (
              <Field.HelperText color="gray.500">For password recovery</Field.HelperText>
            )}
          </Field.Root>

          <Field.Root invalid={!!errors.displayName}>
            <Field.Label color="white">Display Name (In-Game)</Field.Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="How others see you"
              size="lg"
              bg="rgba(0, 0, 0, 0.3)"
              borderColor="rgba(255, 255, 255, 0.2)"
              color="white"
              _hover={{ borderColor: 'rgba(0, 212, 255, 0.5)' }}
              _focus={{ borderColor: '#00d4ff', boxShadow: '0 0 0 1px #00d4ff' }}
            />
            {errors.displayName ? (
              <Field.ErrorText>{errors.displayName}</Field.ErrorText>
            ) : (
              <Field.HelperText color="gray.500">Shown in game lobby (can be duplicate)</Field.HelperText>
            )}
          </Field.Root>

          <Button
            w="100%"
            size="lg"
            bgGradient="linear(to-r, #00d4ff, #7b68ee)"
            color="white"
            mt={2}
            _hover={{
              transform: 'translateY(-2px)',
              boxShadow: '0 8px 30px rgba(0, 212, 255, 0.6)',
            }}
            _active={{ transform: 'translateY(0)' }}
            onClick={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Create Account'}
          </Button>

          <HStack spacing={2}>
            <Text color="gray.400">Already have an account?</Text>
            <Link
              color="#00d4ff"
              fontWeight="bold"
              onClick={onSwitchToLogin}
              _hover={{ textDecoration: 'underline', cursor: 'pointer' }}
            >
              Login
            </Link>
          </HStack>
        </VStack>
      </Box>
    </Box>
  );
}
