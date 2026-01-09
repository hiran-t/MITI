'use client';

import { useState, useMemo } from 'react';
import { Search, RefreshCw } from 'lucide-react';
import type { TopicInfo } from '@/lib/rosbridge/types';
import { ROSBridge } from '@/lib/rosbridge/client';
import TopicCard from './TopicCard';

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
      (t) =>
        t.topic.toLowerCase().includes(term) ||
        t.type.toLowerCase().includes(term)
    );
  }, [topics, searchTerm]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-800 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="p-2 bg-gray-900/50 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors disabled:opacity-50"
          title="Refresh topics"
        >
          <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-400">
          {filteredTopics.length} topic{filteredTopics.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 overflow-auto space-y-3">
        {filteredTopics.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {searchTerm ? 'No topics match your search' : 'No topics available'}
          </div>
        ) : (
          filteredTopics.map((topic) => (
            <TopicCard
              key={topic.topic}
              topic={topic.topic}
              type={topic.type}
              client={client}
            />
          ))
        )}
      </div>
    </div>
  );
}
