'use client';

interface TopicDataDisplayProps {
  data: any;
}

export default function TopicDataDisplay({ data }: TopicDataDisplayProps) {
  if (!data) {
    return (
      <div className="text-center text-gray-500 py-8">
        No data received yet
      </div>
    );
  }

  return (
    <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm text-gray-300 overflow-auto max-h-96">
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
