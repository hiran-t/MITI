'use client';

import { useState, useEffect } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import { topicStyles, cn } from '@/styles';

interface TopicCardProps {
  topic: string;
  type: string;
  client: ROSBridge | null;
}

export default function TopicCard({ topic, type, client }: TopicCardProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const [messageCount, setMessageCount] = useState(0);

  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  useEffect(() => {
    if (!client || !subscribed) return;
    const onMessage = (message: unknown) => {
      setLastMessage(message);
      setMessageCount((count) => count + 1);
      setLastUpdate(new Date());
    };
    client.subscribe(topic, onMessage, type);
    return () => client.unsubscribe(topic, onMessage);
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
