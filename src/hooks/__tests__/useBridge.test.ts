import { defaultBridgeUrl } from '../useBridge';

describe('defaultBridgeUrl', () => {
  const configured = process.env.NEXT_PUBLIC_BRIDGE_URL;
  afterEach(() => {
    if (configured === undefined) delete process.env.NEXT_PUBLIC_BRIDGE_URL;
    else process.env.NEXT_PUBLIC_BRIDGE_URL = configured;
  });

  test('points at foxglove_bridge on the host that served MITI', () => {
    delete process.env.NEXT_PUBLIC_BRIDGE_URL;
    expect(defaultBridgeUrl({ protocol: 'http:', hostname: '192.168.1.40' })).toBe(
      'ws://192.168.1.40:8765'
    );
    expect(defaultBridgeUrl({ protocol: 'https:', hostname: 'miti.local' })).toBe(
      'wss://miti.local:8765'
    );
    expect(defaultBridgeUrl({ protocol: 'http:', hostname: '::1' })).toBe('ws://[::1]:8765');
    expect(defaultBridgeUrl({ protocol: 'file:', hostname: '' })).toBe('ws://localhost:8765');
  });

  test('prefers the address the build was configured with', () => {
    process.env.NEXT_PUBLIC_BRIDGE_URL = 'ws://robot:8765';
    expect(defaultBridgeUrl({ protocol: 'http:', hostname: '192.168.1.40' })).toBe(
      'ws://robot:8765'
    );
  });
});
