'use client';

import { useCallback, useEffect, useState } from 'react';
import { connectionStyles } from '@/styles';

/** GET/PUT /api/bridge (src/app/api/bridge/route.ts, served by scripts/start-miti.mjs). */
export interface BridgeNetworkStatus {
  available: boolean;
  reason?: string;
  domainId?: number;
  peers?: string[];
  distro?: string | null;
  rmw?: string;
  port?: number;
  state?: 'starting' | 'running' | 'stopped';
  exitCode?: number | null;
  log?: string[];
  error?: string;
}

const RMW_NAMES: Record<string, string> = {
  rmw_fastrtps_cpp: 'Fast DDS',
  rmw_cyclonedds_cpp: 'Cyclone DDS',
};

function stateText(status: BridgeNetworkStatus): string {
  if (status.state === 'running') return 'foxglove_bridge running';
  if (status.state === 'starting') return 'Starting foxglove_bridge…';
  return `foxglove_bridge stopped${status.exitCode != null ? ` (exit ${status.exitCode})` : ''}`;
}

async function request(init?: RequestInit): Promise<BridgeNetworkStatus> {
  const response = await fetch('/api/bridge', { cache: 'no-store', ...init });
  const body = (await response.json()) as BridgeNetworkStatus;
  if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
  return body;
}

/**
 * ROS_DOMAIN_ID and the robot's addresses for the foxglove_bridge running beside MITI. Applying
 * them restarts that bridge; MITI reconnects on its own.
 */
export default function BridgeNetworkSettings() {
  const [status, setStatus] = useState<BridgeNetworkStatus | null>(null);
  const [domainId, setDomainId] = useState('0');
  const [peers, setPeers] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const show = useCallback((next: BridgeNetworkStatus, fields: boolean) => {
    setStatus(next);
    if (fields && next.available) {
      setDomainId(String(next.domainId ?? 0));
      setPeers((next.peers ?? []).join(', '));
    }
  }, []);

  useEffect(() => {
    request()
      .then((next) => show(next, true))
      .catch((reason: Error) => setError(reason.message));
  }, [show]);

  // Follow a restart until the bridge answers or stops.
  useEffect(() => {
    if (status?.state !== 'starting') return;
    const timer = setTimeout(
      () =>
        request()
          .then((next) => show(next, false))
          .catch((reason: Error) => setError(reason.message)),
      1000
    );
    return () => clearTimeout(timer);
  }, [status, show]);

  if (!status) return error ? <p className={connectionStyles.network.error}>{error}</p> : null;
  if (!status.available)
    return (
      <div className={connectionStyles.network.section}>
        <p className={connectionStyles.network.title}>ROS network</p>
        <p className={connectionStyles.form.hint}>{status.reason}</p>
      </div>
    );

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      show(
        await request({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domainId, peers }),
        }),
        true
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  };

  const changed =
    domainId.trim() !== String(status.domainId) ||
    peers
      .split(/[\s,;]+/)
      .filter(Boolean)
      .join(',') !== (status.peers ?? []).join(',');
  const lastLine = status.state === 'stopped' ? status.log?.at(-1) : undefined;

  return (
    <div className={connectionStyles.network.section}>
      <p className={connectionStyles.network.title}>
        ROS network of the bridge beside MITI
        <span className={connectionStyles.network.meta}>
          {[status.distro, RMW_NAMES[status.rmw ?? ''] ?? status.rmw].filter(Boolean).join(' · ')}
        </span>
      </p>
      <div className={connectionStyles.network.row}>
        <div className="w-24 shrink-0">
          <label htmlFor="ros-domain-id" className={connectionStyles.form.label}>
            ROS_DOMAIN_ID
          </label>
          <input
            id="ros-domain-id"
            type="number"
            min={0}
            max={232}
            value={domainId}
            onChange={(e) => setDomainId(e.target.value)}
            className={connectionStyles.form.input}
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="ros-peers" className={connectionStyles.form.label}>
            Robot IP addresses
          </label>
          <input
            id="ros-peers"
            type="text"
            value={peers}
            onChange={(e) => setPeers(e.target.value)}
            placeholder="e.g. 192.168.10.27"
            className={connectionStyles.form.input}
          />
        </div>
      </div>
      <p className={connectionStyles.form.hint}>
        Must match the robot. Leave the address empty to find the robot by multicast; add it when
        topics are missing or come and go (Wi-Fi).
      </p>
      <div className={connectionStyles.network.row}>
        <p
          role="status"
          className={`${connectionStyles.network.state} ${
            status.state === 'running'
              ? 'text-ok'
              : status.state === 'starting'
                ? 'text-warn'
                : 'text-danger'
          }`}
          title={status.log?.join('\n')}
        >
          {stateText(status)}
          {lastLine && <span className={connectionStyles.network.log}>{lastLine}</span>}
        </p>
        <button
          onClick={apply}
          disabled={busy || (!changed && status.state !== 'stopped')}
          className={connectionStyles.buttons.apply}
        >
          {busy ? 'Restarting…' : 'Apply and restart bridge'}
        </button>
      </div>
      {error && <p className={connectionStyles.network.error}>{error}</p>}
    </div>
  );
}
