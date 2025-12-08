import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock import.meta.env
vi.mock('import.meta', () => ({
  env: {
    VITE_WS_URL: 'ws://localhost:2567',
  },
}));
