export interface TopicInfo {
  topic: string;
  type: string;
}

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
}
