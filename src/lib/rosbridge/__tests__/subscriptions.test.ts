import { ROSBridge } from '../client';
class Socket {
  static OPEN = 1;
  readyState = 1;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  send = jest.fn();
  close = () => this.onclose?.();
  static instance: Socket;
  constructor() {
    Socket.instance = this;
  }
}
test('late TF subscribers receive retained static transforms and removing one subscriber preserves the others', async () => {
  const original = global.WebSocket;
  global.WebSocket = Socket as unknown as typeof WebSocket;
  try {
    const client = new ROSBridge('ws://localhost:9090');
    const connected = client.connect();
    Socket.instance.onopen?.(new Event('open'));
    await connected;
    const first = jest.fn(),
      second = jest.fn();
    client.subscribe('/tf_static', first);
    const transform = {
      child_frame_id: 'camera',
      header: { frame_id: 'base_link' },
      transform: { translation: { x: 1, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 1 } },
    };
    Socket.instance.onmessage?.(
      new MessageEvent('message', {
        data: JSON.stringify({
          op: 'publish',
          topic: '/tf_static',
          msg: { transforms: [transform] },
        }),
      })
    );
    client.subscribe('/tf_static', second);
    expect(second).toHaveBeenCalledWith({ transforms: [transform] });
    Socket.instance.send.mockClear();
    client.unsubscribe('/tf_static', first);
    expect(Socket.instance.send).not.toHaveBeenCalled();
    client.unsubscribe('/tf_static', second);
    expect(Socket.instance.send).toHaveBeenCalledWith(
      JSON.stringify({ op: 'unsubscribe', topic: '/tf_static' })
    );
    client.disconnect();
    const third = jest.fn();
    client.subscribe('/tf_static', third);
    expect(third).not.toHaveBeenCalled();
  } finally {
    global.WebSocket = original;
  }
});
