'use client';

import { useState, useMemo } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import type { TopicInfo } from '@/lib/rosbridge/types';
import { ROSBridge } from '@/lib/rosbridge/client';
import TopicCard from './TopicCard';
import { topicStyles, cn } from '@/styles';

interface TopicListProps {
  topics: TopicInfo[];
  loading: boolean;
  onRefresh: () => void;
  client: ROSBridge | null;
}

export default function TopicList({ topics, loading, onRefresh, client }: TopicListProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTopics = useMemo(() => {
    if (!searchTerm) return topics;
    const term = searchTerm.toLowerCase();
    return topics.filter(
      (t) => t.topic.toLowerCase().includes(term) || t.type.toLowerCase().includes(term)
    );
  }, [topics, searchTerm]);

  return (
    <div className={topicStyles.list.container}>
      <div className={topicStyles.list.toolbar}>
        <div className={topicStyles.list.searchWrapper}>
          <Search className={topicStyles.list.searchIcon} />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={topicStyles.list.searchInput}
          />
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className={topicStyles.list.refreshButton}
          title="Refresh topics"
        >
          <RefreshCw
            className={cn(
              loading ? topicStyles.list.refreshIconSpinning : topicStyles.list.refreshIcon
            )}
          />
        </button>
      </div>

      <div className={topicStyles.list.stats}>
        <span className={topicStyles.list.statsText}>
          {filteredTopics.length} topic{filteredTopics.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className={topicStyles.list.itemsContainer}>
        {filteredTopics.length === 0 ? (
          <div className={topicStyles.list.emptyState}>
            {searchTerm ? 'No topics match your search' : 'No topics available'}
          </div>
        ) : (
          filteredTopics.map((topic) => (
            <TopicCard key={topic.topic} topic={topic.topic} type={topic.type} client={client} />
          ))
        )}
      </div>
    </div>
  );
}
