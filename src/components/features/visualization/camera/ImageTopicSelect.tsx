'use client';

import { ChevronDown } from 'lucide-react';
import { normalizeMessageType } from '@/lib/bridge/topics';
import type { TopicInfo } from '@/lib/bridge/types';

const IMAGE_TYPES = ['sensor_msgs/msg/Image', 'sensor_msgs/msg/CompressedImage'].map(
  normalizeMessageType
);

/** The image topics the robot publishes, by name. */
export function imageTopics(topics: TopicInfo[]): string[] {
  const images = topics
    .filter((info) => IMAGE_TYPES.includes(normalizeMessageType(info.type)))
    .map((info) => info.topic);
  return Array.from(new Set(images)).sort();
}

interface ImageTopicSelectProps {
  value: string;
  topics: TopicInfo[];
  onChange: (topic: string) => void;
}

/**
 * The panel's image topic, chosen from the images the robot publishes. A topic it does not
 * publish, such as a default name or one typed in the settings, stays in the list, marked.
 */
export default function ImageTopicSelect({ value, topics, onChange }: ImageTopicSelectProps) {
  const images = imageTopics(topics);
  const published = images.includes(value);
  return (
    <div className="pointer-events-auto relative flex max-w-full min-w-0 items-center">
      <select
        aria-label="Image topic"
        title={value}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-full min-w-0 cursor-pointer appearance-none truncate rounded-sm border border-transparent bg-transparent py-0.5 pr-5 pl-1 font-mono text-xs text-gray-400 hover:border-gray-700 hover:bg-gray-900/80 hover:text-gray-200 focus:border-accent focus:outline-none"
      >
        {!value && (
          <option value="" disabled>
            Choose an image topic
          </option>
        )}
        {value && !published && <option value={value}>{value} (not published)</option>}
        {images.map((topic) => (
          <option key={topic} value={topic}>
            {topic}
          </option>
        ))}
        {!images.length && (
          <option value="" disabled>
            The robot publishes no images
          </option>
        )}
      </select>
      <ChevronDown className="pointer-events-none absolute right-1 h-3 w-3 text-gray-500" />
    </div>
  );
}
