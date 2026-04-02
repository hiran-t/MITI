'use client';

import { useState } from 'react';
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

  const handleToggleSubscribe = () => {
    if (!client) return;

    if (subscribed) {
      client.unsubscribe(topic);
      setSubscribed(false);
    } else {
      client.subscribe(
        topic,
        (msg) => {
          setLastMessage(msg);
          setMessageCount((prev) => prev + 1);
        },
        type
      );
      setSubscribed(true);
    }
  };

  return (
    <div className={topicStyles.card.base}>
      <div className={topicStyles.card.header}>
        <div className={topicStyles.card.content}>
          <h3 className={topicStyles.info.topic}>{topic}</h3>
          <p className={topicStyles.info.type}>{type}</p>
        </div>
        <button
          onClick={handleToggleSubscribe}
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
            {lastMessage != null && <span>Last update: {new Date().toLocaleTimeString()}</span>}
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
