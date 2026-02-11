'use client';

import { topicStyles } from '@/styles';

interface TopicDataDisplayProps {
  data: any;
}

export default function TopicDataDisplay({ data }: TopicDataDisplayProps) {
  if (!data) {
    return <div className={topicStyles.data.emptyState}>No data received yet</div>;
  }

  return (
    <div className={topicStyles.data.container}>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
