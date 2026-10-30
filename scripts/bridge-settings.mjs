// ROS network settings of the foxglove_bridge that `pixi run -e <distro> miti-bridge` starts
// beside MITI: the ROS_DOMAIN_ID and the robot's IP addresses (ROS_STATIC_PEERS). They can be
// changed in MITI's connection settings and are kept in .miti/bridge.json, which takes precedence
// over the environment.
import fs from 'node:fs';
import path from 'node:path';

/** Highest ROS_DOMAIN_ID DDS can map to UDP ports. */
export const MAX_DOMAIN_ID = 232;
/** More robot addresses than this is a typo, not a network. */
export const MAX_PEERS = 16;

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);

/** "192.168.10.27, 192.168.10.28" or "a;b" → ["192.168.10.27", "192.168.10.28"]. */
export function splitPeers(text) {
  return String(text ?? '')
    .split(/[\s,;]+/)
    .filter(Boolean);
}

/** Checks settings sent by the web page: `{ settings }` when valid, otherwise `{ error }`. */
export function parseSettings(input) {
  if (!input || typeof input !== 'object') return { error: 'Expected a JSON object' };
  const text = typeof input.domainId === 'string' ? input.domainId.trim() : null;
  const domainId = text === null ? input.domainId : text && /^\d+$/.test(text) ? Number(text) : NaN;
  if (!Number.isInteger(domainId) || domainId < 0 || domainId > MAX_DOMAIN_ID)
    return { error: `ROS_DOMAIN_ID must be a whole number from 0 to ${MAX_DOMAIN_ID}` };
  const list = Array.isArray(input.peers) ? input.peers.map(String) : splitPeers(input.peers);
  const peers = [...new Set(list.map((peer) => peer.trim()).filter(Boolean))];
  const invalid = peers.find((peer) => !IPV4.test(peer));
  if (invalid) return { error: `${invalid} is not an IPv4 address, e.g. 192.168.10.27` };
  if (peers.length > MAX_PEERS) return { error: `At most ${MAX_PEERS} robot addresses` };
  return { settings: { domainId, peers } };
}

/**
 * Saved settings, else ROS_DOMAIN_ID and ROS_STATIC_PEERS from the environment.
 * @param {string} file
 * @param {Record<string, string | undefined>} [env]
 */
export function loadSettings(file, env = process.env) {
  try {
    const { settings } = parseSettings(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (settings) return { ...settings, saved: true };
  } catch {
    // No saved settings yet, or an unreadable file: use the environment.
  }
  return {
    domainId: Number(env.ROS_DOMAIN_ID) || 0,
    peers: splitPeers(env.ROS_STATIC_PEERS),
    saved: false,
  };
}

export function saveSettings(file, { domainId, peers }) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify({ domainId, peers }, null, 2)}\n`);
}

/** The environment that gives foxglove_bridge these settings. */
export function settingsEnv({ domainId, peers }) {
  return { ROS_DOMAIN_ID: String(domainId), ROS_STATIC_PEERS: peers.join(';') };
}

export function describeSettings({ domainId, peers }) {
  return `ROS_DOMAIN_ID=${domainId}${peers.length ? `, robot ${peers.join(', ')}` : ''}`;
}
