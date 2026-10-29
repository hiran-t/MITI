import type { TopicInfo } from './types';

// Each token is a letter or underscore followed by letters, digits or underscores (rcl rules).
const TOPIC_NAME = /^(\/[A-Za-z_][A-Za-z0-9_]*)+$/;

/** ROS 2 accepts both `pkg/Type` and `pkg/msg/Type`; compare them in one form. */
export const normalizeMessageType = (type: string) => type.replace('/msg/', '/');

/** Why a topic name is not a valid ROS name, or null when it is valid or empty. */
export function topicNameError(name: string): string | null {
  if (!name) return null;
  if (!name.startsWith('/')) return 'Topic names start with /';
  if (name.endsWith('/')) return 'Topic names cannot end with /';
  if (name.includes('//')) return 'Topic names cannot contain //';
  if (!TOPIC_NAME.test(name))
    return 'Use letters, digits and _; a segment cannot start with a digit';
  return null;
}

export function findTopicType(topics: TopicInfo[], topic: string): string | undefined {
  return topics.find((t) => t.topic === topic)?.type;
}

/**
 * The topic's actual type when the live topic list shows it cannot deliver any of `expected`.
 * The client does not subscribe to a topic of another type, so this explains the missing data.
 */
export function topicTypeMismatch(
  topics: TopicInfo[],
  topic: string,
  expected: string | string[]
): string | null {
  const actual = findTopicType(topics, topic);
  if (!actual) return null;
  const accepted = (Array.isArray(expected) ? expected : [expected]).map(normalizeMessageType);
  return accepted.includes(normalizeMessageType(actual)) ? null : actual;
}
