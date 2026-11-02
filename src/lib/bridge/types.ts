export interface TopicInfo {
  topic: string;
  type: string;
}

import type { Transform } from './protocol';

export type { Transform };

export type MessageCallback = (message: unknown) => void;
export type ConnectionCallback = () => void;
export type ErrorCallback = (error: Error) => void;

export interface SubscribeOptions {
  /** Keep transforms from this TF topic and replay them to later subscribers. */
  retainTransforms?: boolean;
  /**
   * Deliver at most this many messages per second (Hz); omit for every message. Extra messages
   * are dropped on arrival, which saves decoding and rendering but not network traffic.
   */
  maxRate?: number;
  /**
   * The subscriber shows at most one message per this many ms, the newest. Messages superseded
   * within the window are dropped before they are decoded; the newest is delivered when the
   * window closes.
   */
  throttleMs?: number;
  /**
   * Over miti_bridge, have the bridge transform the topic's messages on the robot before they
   * cross the network. It applies only when every subscriber of the topic asks for the same
   * transform, because they all receive its output: a `jpeg` subscriber of a raw Image topic gets
   * `sensor_msgs/CompressedImage` messages, and must show both. `jpeg` waits for a raw frame whose
   * encoding JPEG can hold (rgb8, bgr8, rgba8, bgra8, mono8); depth and Bayer images stay raw.
   * foxglove_bridge ignores it.
   */
  transform?: Transform;
}

/** How the link to miti_bridge is doing, from the bridge's reports on every connection. */
export interface LinkStats {
  /** What the bridge sent, every topic together. */
  bytesPerSecond: number;
  /** Messages the bridge did not send: rate limits, replaced frames, full queues. */
  droppedPerSecond: number;
  /** Bytes waiting on the bridge to be sent. */
  bufferedBytes: number;
  /** How long the oldest waiting message has waited, ms. */
  oldestQueuedMs: number;
  topics: {
    topic: string;
    bytesPerSecond: number;
    sentPerSecond: number;
    droppedPerSecond: number;
  }[];
}
