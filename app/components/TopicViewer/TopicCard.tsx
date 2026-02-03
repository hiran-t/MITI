'use client';

import { useState } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';

interface TopicCardProps {
  topic: string;
  type: string;
  client: ROSBridge | null;
}

export default function TopicCard({ topic, type, client }: TopicCardProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [messageCount, setMessageCount] = useState(0);

  const handleToggleSubscribe = () => {
    if (!client) return;

    if (subscribed) {
      client.unsubscribe(topic);
      setSubscribed(false);
    } else {
      client.subscribe(topic, (msg) => {
        setLastMessage(msg);
        setMessageCount(prev => prev + 1);
      }, type);
      setSubscribed(true);
    }
  };

  return (
    <div className="bg-gray-900/50 rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-mono text-white truncate">{topic}</h3>
          <p className="text-xs text-gray-400 mt-1">{type}</p>
        </div>
        <button
          onClick={handleToggleSubscribe}
          className={`ml-2 px-3 py-1 text-xs font-medium rounded transition-colors ${
            subscribed
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-gradient-to-r from-lime-400/20 to-cyan-400/20 text-cyan-300 hover:from-lime-400/30 hover:to-cyan-400/30'
          }`}
        >
          {subscribed ? 'Unsubscribe' : 'Subscribe'}
        </button>
      </div>
      
      {subscribed && (
        <div className="mt-3 pt-3 border-t border-gray-800">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>Messages: {messageCount}</span>
            {lastMessage && <span>Last update: {new Date().toLocaleTimeString()}</span>}
          </div>
          
          {lastMessage && (
            <div className="mt-2 p-2 bg-gray-950 rounded text-xs font-mono text-gray-300 max-h-32 overflow-auto">
              <pre>{JSON.stringify(lastMessage, null, 2)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
