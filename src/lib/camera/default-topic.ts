import { CAMERA_TOPICS } from '@/constants/ros-topics';
import type { TopicInfo } from '@/lib/bridge/types';

const IMAGE_TYPE = /^sensor_msgs\/(msg\/)?(Image|CompressedImage)$/;

/** For each default camera topic, the names of the same kind of image, best match first. */
const KINDS: Record<string, RegExp[]> = {
  [CAMERA_TOPICS.COLOR]: [/\/color\/image_raw$/, /\/color\/image\w*(\/compressed)?$/, /color|rgb/],
  [CAMERA_TOPICS.DEPTH]: [
    /\/depth\/image(_rect)?_raw$/,
    /aligned_depth_to_color\/image_raw$/,
    /depth.*image/,
  ],
  [CAMERA_TOPICS.IR]: [/\/(ir|infra\d?)\/image(_rect)?_raw$/, /infra|\/ir\//],
};

/** Topics under /camera first (the robot's main camera), then the shortest name. */
function rank(a: TopicInfo, b: TopicInfo): number {
  const main = (t: TopicInfo) => (t.topic.startsWith('/camera/') ? 0 : 1);
  return main(a) - main(b) || a.topic.length - b.topic.length;
}

/**
 * A camera panel still on a default topic the robot does not publish shows the robot's own topic
 * for that kind of image instead, e.g. `/camera/camera/color/image_raw` from a RealSense driver.
 * Returns the topic to switch to, or undefined to keep the panel's topic: one the user chose, one
 * that is published, or one with no match.
 */
export function publishedCameraTopic(topic: string, topics: TopicInfo[]): string | undefined {
  const patterns = KINDS[topic];
  if (!patterns || !topics.length || topics.some((t) => t.topic === topic)) return undefined;
  const images = topics.filter((t) => IMAGE_TYPE.test(t.type)).sort(rank);
  for (const pattern of patterns) {
    const found = images.find((t) => pattern.test(t.topic));
    if (found) return found.topic;
  }
  return undefined;
}
