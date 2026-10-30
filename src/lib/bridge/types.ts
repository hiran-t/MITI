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
  /**
   * The subscriber shows at most one message per this many ms, the newest. Messages superseded
   * within the window are dropped before they are decoded; the newest is delivered when the
   * window closes.
   */
  throttleMs?: number;
}
