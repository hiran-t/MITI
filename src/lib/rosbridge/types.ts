// ROS message types
export interface ROSMessage {
  op: string;
  [key: string]: unknown;
}

export interface TopicInfo {
  topic: string;
  type: string;
}

export interface SubscribeMessage {
  op: 'subscribe';
  topic: string;
  type?: string;
  throttle_rate?: number;
  queue_length?: number;
}

export interface UnsubscribeMessage {
  op: 'unsubscribe';
  topic: string;
}

export interface AdvertiseMessage {
  op: 'advertise';
  topic: string;
  type: string;
}

export interface PublishMessage {
  op: 'publish';
  topic: string;
  msg: unknown;
}

export interface ServiceCallMessage {
  op: 'call_service';
  service: string;
  args?: unknown;
}

export interface TopicMessage {
  op: 'publish';
  topic: string;
  msg: unknown;
}

export type MessageCallback = (message: unknown) => void;
export type ConnectionCallback = () => void;
export type ErrorCallback = (error: Error) => void;
