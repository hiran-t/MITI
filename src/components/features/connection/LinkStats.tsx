'use client';
import { Fragment, useEffect, useState } from 'react';
import type { BridgeClient } from '@/lib/bridge/client';
import type { LinkStats } from '@/lib/bridge/types';

type StatsSource = Pick<BridgeClient, 'getLinkStats' | 'onLinkStats'>;

/** A message waiting longer than this on the robot means the link cannot keep up. */
const BACKLOG_MS = 500;
/** Topics listed in the source details, the busiest first. */
const TOPIC_ROWS = 5;

/** miti_bridge's latest report on the link; null with another bridge or while disconnected. */
export function useLinkStats(client: StatsSource | null): LinkStats | null {
  const [stats, setStats] = useState<LinkStats | null>(null);
  useEffect(() => {
    setStats(client?.getLinkStats() ?? null);
    return client?.onLinkStats(setStats);
  }, [client]);
  return stats;
}

const formatBytes = (bytes: number) =>
  bytes >= 1e6
    ? `${(bytes / 1e6).toFixed(1)} MB`
    : bytes >= 1e3
      ? `${Math.round(bytes / 1e3)} KB`
      : `${Math.round(bytes)} B`;

const formatCount = (perSecond: number) =>
  perSecond >= 10 || Number.isInteger(perSecond)
    ? String(Math.round(perSecond))
    : perSecond.toFixed(1);

/** The status bar's view of the link: what miti_bridge sends per second. */
export function LinkStatusItem({ client }: { client: StatsSource | null }) {
  const stats = useLinkStats(client);
  if (!stats) return null;
  const behind = stats.oldestQueuedMs > BACKLOG_MS;
  return (
    <span
      className={`status-item is-optional ${behind ? 'is-behind' : ''}`}
      title={
        `miti_bridge sends ${formatBytes(stats.bytesPerSecond)}/s and drops ` +
        `${formatCount(stats.droppedPerSecond)} messages/s` +
        (behind ? `; the oldest waiting has waited ${Math.round(stats.oldestQueuedMs)} ms` : '')
      }
    >
      {formatBytes(stats.bytesPerSecond)}/s
    </span>
  );
}

/** Rows of the source details: the link, and the topics that use most of it. */
export function LinkStatsRows({ client }: { client: StatsSource | null }) {
  const stats = useLinkStats(client);
  if (!stats) return null;
  return (
    <>
      <dt>Link</dt>
      <dd>
        {formatBytes(stats.bytesPerSecond)}/s · {formatCount(stats.droppedPerSecond)} dropped/s
      </dd>
      <dt>Waiting</dt>
      <dd>
        {formatBytes(stats.bufferedBytes)}
        {stats.oldestQueuedMs > 0 && ` · oldest ${Math.round(stats.oldestQueuedMs)} ms`}
      </dd>
      {stats.topics.slice(0, TOPIC_ROWS).map((topic) => (
        <Fragment key={topic.topic}>
          <dt className="truncate" title={topic.topic}>
            {topic.topic}
          </dt>
          <dd>
            {formatBytes(topic.bytesPerSecond)}/s · {formatCount(topic.sentPerSecond)} msg/s
            {topic.droppedPerSecond > 0 && ` · ${formatCount(topic.droppedPerSecond)} dropped`}
          </dd>
        </Fragment>
      ))}
    </>
  );
}
