export const createSubscribeMessage = (topic: string, type?: string, throttleRate?: number) => ({
  op: 'subscribe',
  topic,
  ...(type && { type }),
  ...(throttleRate && { throttle_rate: throttleRate }),
});

export const createUnsubscribeMessage = (topic: string) => ({
  op: 'unsubscribe',
  topic,
});

export const createAdvertiseMessage = (topic: string, type: string) => ({
  op: 'advertise',
  topic,
  type,
});

export const createPublishMessage = (topic: string, msg: any) => ({
  op: 'publish',
  topic,
  msg,
});

export const createServiceCallMessage = (service: string, args?: any) => ({
  op: 'call_service',
  service,
  ...(args && { args }),
});

export const createGetTopicsMessage = () => ({
  op: 'call_service',
  service: '/rosapi/topics',
});

export const createGetTopicTypeMessage = (topic: string) => ({
  op: 'call_service',
  service: '/rosapi/topic_type',
  args: { topic },
});
