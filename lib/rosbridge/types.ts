// ROS message types
export interface ROSMessage {
  op: string;
  [key: string]: any;
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
  msg: any;
}

export interface ServiceCallMessage {
  op: 'call_service';
  service: string;
  args?: any;
}

export interface TopicMessage {
  op: 'publish';
  topic: string;
  msg: any;
}

export type MessageCallback = (message: any) => void;
export type ConnectionCallback = () => void;
export type ErrorCallback = (error: Error) => void;
