/**
 * The bridge protocol: the MITI protocol (`miti.bridge.v1`, served by miti_bridge) and the base
 * protocol it builds on. The protocol is specified in MITI-sdk's docs/protocol.md.
 *
 * `ProtocolClient` adds the `miti.*` operations to the base protocol: they are sent only to a
 * server that selected `miti.bridge.v1`.
 */

export const MITI_SUBPROTOCOL = 'miti.bridge.v1';
/** Offered in this order: miti_bridge picks the first; other bridges pick a later one. */
export const SUBPROTOCOLS = [MITI_SUBPROTOCOL, 'foxglove.sdk.v1', 'foxglove.websocket.v1'];

export const StatusLevel = { INFO: 0, WARNING: 1, ERROR: 2 } as const;
export const FetchAssetStatus = { SUCCESS: 0, ERROR: 1 } as const;

export interface Channel {
  id: number;
  topic: string;
  encoding: string;
  schemaName: string;
  schema: string;
  schemaEncoding?: string;
}

export interface MessageDefinition {
  encoding: string;
  schemaName: string;
  schemaEncoding: string;
  schema: string;
}

export interface Service {
  id: number;
  name: string;
  type: string;
  request?: MessageDefinition;
  response?: MessageDefinition;
  /** Older bridges send these instead of `request` and `response`. */
  requestSchema?: string;
  responseSchema?: string;
}

export interface ServerInfo {
  op: 'serverInfo';
  name: string;
  capabilities: string[];
  supportedEncodings?: string[];
  metadata?: Record<string, string>;
  sessionId?: string;
}

export interface StatusMessage {
  op: 'status';
  level: number;
  message: string;
  id?: string;
}

export interface ParameterValues {
  op: 'parameterValues';
  parameters: { name: string; value: unknown; type?: string }[];
  id?: string;
}

export interface ServiceCallFailure {
  op: 'serviceCallFailure';
  serviceId: number;
  callId: number;
  message: string;
}

export interface MessageData {
  subscriptionId: number;
  timestamp: bigint;
  data: DataView;
}

export interface ServiceCallResponse {
  serviceId: number;
  callId: number;
  encoding: string;
  data: DataView;
}

export type FetchAssetResponse =
  | { requestId: number; status: typeof FetchAssetStatus.SUCCESS; data: DataView }
  | { requestId: number; status: typeof FetchAssetStatus.ERROR; error: string };

/** The reply to `miti.getSchema`: the type's definition, or why there is none. */
export interface SchemaReply {
  op: 'miti.schema';
  id?: string;
  type: string;
  schemaName?: string;
  schemaEncoding?: string;
  schema?: string;
  error?: string;
}

/** What the server does to each message of a subscription before sending it (protocol.md). */
export type Transform =
  | { kind: 'jpeg'; quality?: number; maxWidth?: number }
  | { kind: 'reduce'; fields?: string[]; voxel?: number; stride?: number; maxPoints?: number };

export interface SubscriptionOptions {
  /** Messages per second; null removes the limit. */
  maxRate?: number | null;
  delivery?: 'all' | 'latest';
  priority?: 'high' | 'normal' | 'low';
  /** null removes the transform. */
  transform?: Transform | null;
}

/** The format of a subscription's messages from now on, after a transform changed it. */
export interface SubscriptionFormat {
  op: 'miti.subscriptionFormat';
  subscriptionId: number;
  encoding: string;
  schemaName: string;
  schemaEncoding?: string;
  schema: string;
}

/** What one connection sent and dropped over the last interval (miti.subscribeStats). */
export interface StatsReport {
  op: 'miti.stats';
  /** Unix time, ms. */
  timestamp: number;
  /** Bytes waiting on the server to be sent on this connection. */
  bufferedBytes: number;
  subscriptions: {
    subscriptionId: number;
    bytesPerSecond: number;
    sent: number;
    dropped: number;
    oldestQueuedMs: number;
  }[];
}

interface Events {
  serverInfo: (info: ServerInfo) => void;
  status: (status: StatusMessage) => void;
  advertise: (channels: Channel[]) => void;
  unadvertise: (channelIds: number[]) => void;
  advertiseServices: (services: Service[]) => void;
  unadvertiseServices: (serviceIds: number[]) => void;
  parameterValues: (values: ParameterValues) => void;
  serviceCallFailure: (failure: ServiceCallFailure) => void;
  message: (message: MessageData) => void;
  time: (time: { timestamp: bigint }) => void;
  serviceCallResponse: (response: ServiceCallResponse) => void;
  fetchAssetResponse: (response: FetchAssetResponse) => void;
  schema: (reply: SchemaReply) => void;
  subscriptionFormat: (format: SubscriptionFormat) => void;
  stats: (report: StatsReport) => void;
  error: (error: Error) => void;
  close: (event: unknown) => void;
}

const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

/** A server → client binary frame, as the event it becomes. */
function parseBinary(buffer: ArrayBuffer): [keyof Events, unknown] {
  const view = new DataView(buffer);
  let offset = 1;
  const uint32 = () => {
    const value = view.getUint32(offset, true);
    offset += 4;
    return value;
  };
  const string = () => {
    const length = uint32();
    const text = textDecoder.decode(new Uint8Array(buffer, offset, length));
    offset += length;
    return text;
  };
  const rest = () => new DataView(buffer, offset);
  switch (view.getUint8(0)) {
    case 0x01: {
      const subscriptionId = uint32();
      const timestamp = view.getBigUint64(offset, true);
      offset += 8;
      return ['message', { subscriptionId, timestamp, data: rest() }];
    }
    case 0x02:
      return ['time', { timestamp: view.getBigUint64(offset, true) }];
    case 0x03: {
      const serviceId = uint32();
      const callId = uint32();
      const encoding = string();
      return ['serviceCallResponse', { serviceId, callId, encoding, data: rest() }];
    }
    case 0x04: {
      const requestId = uint32();
      const status = view.getUint8(offset);
      offset += 1;
      const error = string();
      return [
        'fetchAssetResponse',
        status === FetchAssetStatus.SUCCESS
          ? { requestId, status, data: rest() }
          : { requestId, status, error },
      ];
    }
    default:
      throw new Error(`Unknown binary opcode ${view.getUint8(0)}`);
  }
}

/** Opcode, then each part: numbers as uint32, strings length-prefixed, bytes as they are. */
function binary(opcode: number, ...parts: (number | string | Uint8Array)[]): Uint8Array {
  const chunks = parts.map((part) => {
    if (part instanceof Uint8Array) return part;
    const text = typeof part === 'string' ? textEncoder.encode(part) : null;
    const chunk = new Uint8Array(4 + (text?.length ?? 0));
    new DataView(chunk.buffer).setUint32(0, text ? text.length : (part as number), true);
    if (text) chunk.set(text, 4);
    return chunk;
  });
  const out = new Uint8Array(1 + chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  out[0] = opcode;
  let offset = 1;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export class ProtocolClient {
  private ws: WebSocket;
  private listeners = new Map<keyof Events, Set<(...args: never[]) => void>>();
  private nextSubscriptionId = 0;
  private nextChannelId = 0;

  constructor({ ws }: { ws: WebSocket }) {
    this.ws = ws;
    ws.binaryType = 'arraybuffer';
    ws.onerror = (event) => {
      this.emit('error', (event as { error?: Error }).error ?? new Error('WebSocket error'));
    };
    ws.onmessage = (event: MessageEvent) => this.receive(event.data);
    ws.onclose = (event) => this.emit('close', event);
  }

  /** Whether the server selected miti.bridge.v1, and so takes the miti.* operations. */
  get isMiti(): boolean {
    return this.ws.protocol === MITI_SUBPROTOCOL;
  }

  on<E extends keyof Events>(event: E, listener: Events[E]): void {
    let listeners = this.listeners.get(event);
    if (!listeners) this.listeners.set(event, (listeners = new Set()));
    listeners.add(listener as (...args: never[]) => void);
  }

  close(): void {
    this.ws.close();
  }

  subscribe(channelId: number): number {
    const id = this.nextSubscriptionId++;
    this.send({ op: 'subscribe', subscriptions: [{ id, channelId }] });
    return id;
  }

  unsubscribe(subscriptionId: number): void {
    this.send({ op: 'unsubscribe', subscriptionIds: [subscriptionId] });
  }

  /** Declares a channel to publish on and returns its id. */
  advertise(channel: Omit<Channel, 'id' | 'schema'> & { schema?: string }): number {
    const id = ++this.nextChannelId;
    this.send({ op: 'advertise', channels: [{ id, ...channel }] });
    return id;
  }

  unadvertise(channelId: number): void {
    this.send({ op: 'unadvertise', channelIds: [channelId] });
  }

  sendMessage(channelId: number, data: Uint8Array): void {
    this.ws.send(binary(0x01, channelId, data));
  }

  sendServiceCallRequest(request: {
    serviceId: number;
    callId: number;
    encoding: string;
    data: Uint8Array;
  }): void {
    this.ws.send(binary(0x02, request.serviceId, request.callId, request.encoding, request.data));
  }

  getParameters(parameterNames: string[], id?: string): void {
    this.send({ op: 'getParameters', parameterNames, id });
  }

  fetchAsset(uri: string, requestId: number): void {
    this.send({ op: 'fetchAsset', uri, requestId });
  }

  /** miti.bridge.v1 only: how the server sends a subscription. Returns whether it was sent. */
  setSubscriptionOptions(subscriptionId: number, options: SubscriptionOptions): boolean {
    if (!this.isMiti) return false;
    this.send({ op: 'miti.subscriptionOptions', subscriptionId, ...options });
    return true;
  }

  /** miti.bridge.v1 with miti.schemas: asks for a type's definition, answered by a `schema` event. */
  getSchema(type: string, id: string): void {
    this.send({ op: 'miti.getSchema', type, id });
  }

  /** miti.bridge.v1 with miti.stats: a `stats` event every interval until unsubscribed. */
  subscribeStats(intervalMs = 1000): void {
    this.send({ op: 'miti.subscribeStats', intervalMs });
  }

  unsubscribeStats(): void {
    this.send({ op: 'miti.unsubscribeStats' });
  }

  private send(message: object): void {
    this.ws.send(JSON.stringify(message));
  }

  private emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): void {
    this.listeners.get(event)?.forEach((listener) => (listener as Events[E])(...(args as [never])));
  }

  private receive(data: unknown): void {
    let event: keyof Events;
    let payload: unknown;
    try {
      if (data instanceof ArrayBuffer) {
        [event, payload] = parseBinary(data);
      } else {
        const message = JSON.parse(String(data)) as { op: string; [field: string]: unknown };
        switch (message.op) {
          case 'advertise':
            [event, payload] = ['advertise', message.channels];
            break;
          case 'unadvertise':
            [event, payload] = ['unadvertise', message.channelIds];
            break;
          case 'advertiseServices':
            [event, payload] = ['advertiseServices', message.services];
            break;
          case 'unadvertiseServices':
            [event, payload] = ['unadvertiseServices', message.serviceIds];
            break;
          case 'miti.schema':
            [event, payload] = ['schema', message];
            break;
          case 'miti.subscriptionFormat':
            [event, payload] = ['subscriptionFormat', message];
            break;
          case 'miti.stats':
            [event, payload] = ['stats', message];
            break;
          case 'serverInfo':
          case 'status':
          case 'parameterValues':
          case 'serviceCallFailure':
            [event, payload] = [message.op, message];
            break;
          default:
            return; // operations this client does not use
        }
      }
    } catch (error) {
      this.emit('error', error instanceof Error ? error : new Error(String(error)));
      return;
    }
    this.emit(event, payload as never);
  }
}
