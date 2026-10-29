'use client';

import { useState, useEffect } from 'react';
import { BridgeClient, isHeavyType } from '@/lib/bridge/client';
import { topicStyles, cn } from '@/styles';
import { summarizeMessage } from '@/lib/parsers/message-summary';

// Render at most 4×/s. Stringifying every image or point cloud message would freeze the UI.
const RENDER_INTERVAL_MS = 250;

interface TopicCardProps {
  topic: string;
  type: string;
  client: BridgeClient | null;
}

export default function TopicCard({ topic, type, client }: TopicCardProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const [messageCount, setMessageCount] = useState(0);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  useEffect(() => {
    if (!client || !subscribed) return;
    // Throttle rendering only: the client shares one subscription per topic with other panels.
    let latest: unknown = null;
    let received = 0;
    let receivedAt: Date | null = null;
    const onMessage = (message: unknown) => {
      latest = message;
      received += 1;
      receivedAt = new Date();
    };
    const timer = setInterval(() => {
      if (!receivedAt) return;
      const count = received;
      setLastMessage(summarizeMessage(latest));
      setMessageCount((total) => total + count);
      setLastUpdate(receivedAt);
      received = 0;
      receivedAt = null;
    }, RENDER_INTERVAL_MS);
    // The card shows a few updates per second; images and clouds need not cross the link faster.
    client.subscribe(topic, onMessage, type, isHeavyType(type) ? { maxRate: 2 } : undefined);
    return () => {
      clearInterval(timer);
      client.unsubscribe(topic, onMessage);
    };
  }, [client, subscribed, topic, type]);
  const handleToggleSubscribe = () => setSubscribed((value) => !value);

  return (
    <div className={topicStyles.card.base}>
      <div className={topicStyles.card.header}>
        <div className={topicStyles.card.content}>
          <h3 className={topicStyles.info.topic}>{topic}</h3>
          <p className={topicStyles.info.type}>{type}</p>
        </div>
        <button
          onClick={handleToggleSubscribe}
          disabled={!client}
          className={cn(
            topicStyles.button.base,
            subscribed ? topicStyles.button.subscribed : topicStyles.button.unsubscribed
          )}
        >
          {subscribed ? 'Unsubscribe' : 'Subscribe'}
        </button>
      </div>

      {subscribed && (
        <div className={topicStyles.message.container}>
          <div className={topicStyles.message.stats}>
            <span>Messages: {messageCount}</span>
            {lastUpdate && <span>Last update: {lastUpdate.toLocaleTimeString()}</span>}
          </div>

          {lastMessage != null && (
            <div className={topicStyles.message.json}>
              <pre>{JSON.stringify(lastMessage, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
