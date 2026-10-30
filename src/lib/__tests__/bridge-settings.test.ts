import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  loadSettings,
  parseSettings,
  saveSettings,
  settingsEnv,
  splitPeers,
} from '../../../scripts/bridge-settings.mjs';

describe('bridge ROS settings', () => {
  test('accepts a domain and robot addresses in any separator', () => {
    expect(parseSettings({ domainId: 5, peers: '192.168.10.27, 10.0.0.5;10.0.0.5' })).toEqual({
      settings: { domainId: 5, peers: ['192.168.10.27', '10.0.0.5'] },
    });
    expect(parseSettings({ domainId: ' 0 ', peers: [] })).toEqual({
      settings: { domainId: 0, peers: [] },
    });
    expect(splitPeers(' a  b,c ')).toEqual(['a', 'b', 'c']);
  });

  test('refuses what DDS or the generated XML cannot take', () => {
    expect(parseSettings({ domainId: 233, peers: '' }).error).toMatch(/0 to 232/);
    expect(parseSettings({ domainId: 1.5, peers: '' }).error).toMatch(/whole number/);
    expect(parseSettings({ domainId: '', peers: '' }).error).toMatch(/whole number/);
    expect(parseSettings({ domainId: '1e1', peers: '' }).error).toMatch(/whole number/);
    expect(parseSettings({ domainId: 0, peers: '999.1.1.1' }).error).toMatch(/not an IPv4/);
    expect(parseSettings({ domainId: 0, peers: '1.2.3.4"/><x' }).error).toMatch(/not an IPv4/);
    expect(parseSettings({ domainId: 0, peers: 'robot.local' }).error).toMatch(/not an IPv4/);
    expect(parseSettings(null).error).toBeTruthy();
  });

  test('saved settings win over the environment', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'miti-')), '.miti', 'bridge.json');
    const env = { ROS_DOMAIN_ID: '3', ROS_STATIC_PEERS: '10.0.0.1;10.0.0.2' };
    expect(loadSettings(file, env)).toEqual({
      domainId: 3,
      peers: ['10.0.0.1', '10.0.0.2'],
      saved: false,
    });
    saveSettings(file, { domainId: 7, peers: ['192.168.10.27'] });
    expect(loadSettings(file, env)).toEqual({ domainId: 7, peers: ['192.168.10.27'], saved: true });
    expect(settingsEnv({ domainId: 7, peers: ['a', 'b'] })).toEqual({
      ROS_DOMAIN_ID: '7',
      ROS_STATIC_PEERS: 'a;b',
    });
  });
});
