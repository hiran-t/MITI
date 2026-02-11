'use client';

import { useState, useEffect, useCallback } from 'react';
import { ROSBridge } from '@/lib/rosbridge/client';
import type { TopicInfo } from '@/lib/rosbridge/types';

export function useTopicList(client: ROSBridge | null) {
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refreshTopics = useCallback(async () => {
    if (!client || !client.isConnected()) return;

    setLoading(true);
    setError(null);

    try {
      const topicList = await client.getTopics();
      setTopics(topicList);
    } catch (err) {
      setError(err as Error);
      console.error('Error fetching topics:', err);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (client && client.isConnected()) {
      refreshTopics();
    }
  }, [client, refreshTopics]);

  return {
    topics,
    loading,
    error,
    refreshTopics,
  };
}
