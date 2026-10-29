'use client';

import { useState, useEffect, useCallback } from 'react';
import { BridgeClient } from '@/lib/bridge/client';
import type { TopicInfo } from '@/lib/bridge/types';

/** Topics advertised by foxglove_bridge; the list updates as the bridge advertises changes. */
export function useTopicList(client: BridgeClient | null): {
  topics: TopicInfo[];
  loading: boolean;
  error: Error | null;
  refreshTopics: () => void;
} {
  const [topics, setTopics] = useState<TopicInfo[]>([]);

  const refreshTopics = useCallback(() => {
    setTopics(client?.getTopics() ?? []);
  }, [client]);

  useEffect(() => {
    refreshTopics();
    if (!client) return;
    return client.onTopicsChanged(setTopics);
  }, [client, refreshTopics]);

  return { topics, loading: false, error: null, refreshTopics };
}
