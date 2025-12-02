import { useState } from 'react';
import {
  Box,
  Button,
  Input,
  VStack,
  Text,
} from '@chakra-ui/react';
import { Field } from '@chakra-ui/react/field';
import { authService } from '../services/authService';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateEmail = (): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!emailRegex.test(email)) {
      setError('Invalid email format');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateEmail()) return;

    setIsLoading(true);
    setSuccess(false);

    try {
      const response = await authService.forgotPassword(email);

      if (!response.success) {
        alert('Error: ' + (response.error || 'Failed to send recovery email'));
        return;
      }

      setSuccess(true);
      alert('Email Sent: Check your email for your password');

      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (error) {
      console.error('Forgot password error:', error);
      alert('Connection Error: Could not connect to server. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <Box
        position="fixed"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="rgba(0, 0, 0, 0.7)"
        backdropFilter="blur(10px)"
        zIndex={1000}
        onClick={handleClose}
      />

      {/* Modal */}
      <Box
        position="fixed"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        bg="rgba(26, 26, 46, 0.95)"
        borderColor="rgba(0, 212, 255, 0.3)"
        borderWidth="2px"
        borderRadius="15px"
        maxW="500px"
        w="90%"
        p={8}
        zIndex={1001}
        boxShadow="0 8px 32px rgba(0, 0, 0, 0.5)"
      >
        {/* Close button */}
        <Box
          position="absolute"
          top={4}
          right={4}
          cursor="pointer"
          onClick={handleClose}
          color="white"
          fontSize="xl"
          _hover={{ color: '#00d4ff' }}
        >
          ✕
        </Box>

        {/* Header */}
        <Text
          fontSize="2xl"
          fontWeight="bold"
          bgGradient="linear(to-r, #00d4ff, #7b68ee)"
          bgClip="text"
          mb={6}
        >
          Forgot Password
        </Text>

        {/* Body */}
        {success ? (
          <VStack gap={4} py={4}>
            <Text color="green.400" fontSize="lg" textAlign="center">
              ✅ Password sent to your email!
            </Text>
            <Text color="gray.400" fontSize="sm" textAlign="center">
              Check your inbox for your login credentials.
            </Text>
          </VStack>
        ) : (
          <VStack gap={4}>
            <Text color="gray.300" fontSize="sm">
              Enter your email address and we'll send you your password.
            </Text>

            <Field.Root invalid={!!error} w="100%">
              <Field.Label color="white">Email Address</Field.Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="your@email.com"
                size="lg"
                bg="rgba(0, 0, 0, 0.3)"
                borderColor="rgba(255, 255, 255, 0.2)"
                color="white"
                _hover={{ borderColor: 'rgba(0, 212, 255, 0.5)' }}
                _focus={{
                  borderColor: '#00d4ff',
                  boxShadow: '0 0 0 1px #00d4ff',
                }}
              />
              {error && <Field.ErrorText>{error}</Field.ErrorText>}
            </Field.Root>

            {/* Footer buttons */}
            <Box display="flex" gap={3} w="100%" justifyContent="flex-end" mt={4}>
              <Button
                variant="ghost"
                onClick={handleClose}
                color="gray.400"
                _hover={{ bg: 'rgba(255, 255, 255, 0.1)' }}
              >
                Cancel
              </Button>
              <Button
                bgGradient="linear(to-r, #00d4ff, #7b68ee)"
                color="white"
                onClick={handleSubmit}
                disabled={isLoading}
                _hover={{
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 30px rgba(0, 212, 255, 0.6)',
                }}
              >
                {isLoading ? 'Sending...' : 'Send Password'}
              </Button>
            </Box>
          </VStack>
        )}
      </Box>
    </>
  );
}
