import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import { useRosbridge } from '../useRosbridge';

// Mock the ROSBridge client
jest.mock('@/lib/rosbridge/client');

describe('useRosbridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => useRosbridge());

    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should connect to default URL when no URL provided', () => {
    const { result } = renderHook(() => useRosbridge());

    expect(result.current.client).toBeDefined();
  });

  it('should connect to custom URL when provided', () => {
    const customUrl = 'ws://custom:9090';
    const { result } = renderHook(() => useRosbridge(customUrl));

    expect(result.current.client).toBeDefined();
  });

  // Add more tests as needed
});
