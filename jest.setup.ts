import '@testing-library/jest-dom';

// Mock WebSocket for tests
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  send: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: WebSocket.OPEN,
})) as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
})) as any;

// Browsers provide TextEncoder/TextDecoder (used to decode bridge messages); jsdom does not.
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
Object.assign(globalThis, {
  TextEncoder: globalThis.TextEncoder ?? NodeTextEncoder,
  TextDecoder: globalThis.TextDecoder ?? NodeTextDecoder,
});
