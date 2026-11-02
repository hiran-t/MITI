import { clearCachedAssets, readCachedAsset, writeCachedAsset } from './asset-cache';
import { createDecoder, createEncoder, ros2TypeName, type Decoder, type Encoder } from './codec';
import { DecodePool, DecodePoolFailure } from './decode-pool';
import {
  FetchAssetStatus,
  ProtocolClient,
  StatusLevel,
  SUBPROTOCOLS,
  type Channel,
  type FetchAssetResponse,
  type ParameterValues,
  type SchemaReply,
  type ServerInfo,
  type Service,
  type ServiceCallFailure,
  type ServiceCallResponse,
  type StatsReport,
  type SubscriptionOptions,
  type Transform,
} from './protocol';
import { normalizeMessageType } from './topics';
import type {
  ConnectionCallback,
  ErrorCallback,
  LinkStats,
  MessageCallback,
  SubscribeOptions,
  TopicInfo,
} from './types';

const RECONNECT_MS = 3000;
const REQUEST_TIMEOUT_MS = 5000;
// Robot meshes are megabytes each and a URDF can reference dozens; fetch a few at a time so each
// request's timeout covers only its own transfer.
const ASSET_TIMEOUT_MS = 60000;
const MAX_ASSETS_IN_FLIGHT = 4;
// The bridge drops replies when the link is saturated (e.g. by raw camera streams); ask again.
const ASSET_ATTEMPTS = 3;
/** A heavy topic's connection is kept this long after its last subscriber leaves, for reuse. */
const LANE_IDLE_MS = 30000;
/** Fall back to the control connection after this many failed attempts to open a topic's own. */
const LANE_FALLBACK_AFTER = 2;
const ASSETS_LANE = '#assets';
/** How often miti_bridge reports what each connection sent and dropped. */
const STATS_INTERVAL_MS = 1000;
const textEncoder = new TextEncoder();

/** Raw image encodings miti_bridge's jpeg transform can encode. */
const JPEG_ENCODINGS = new Set(['rgb8', 'bgr8', 'rgba8', 'bgra8', 'mono8']);
/** The message type each transform takes. */
const TRANSFORM_INPUTS: Record<Transform['kind'], string> = {
  jpeg: normalizeMessageType('sensor_msgs/Image'),
  reduce: normalizeMessageType('sensor_msgs/PointCloud2'),
};
/** Equal for transforms with the same parameters, whatever their order. */
const transformKey = (transform: Transform) =>
  JSON.stringify(transform, Object.keys(transform).sort());

/**
 * Message types that are large enough to delay everything queued behind them. They travel on a
 * second connection, so TF, joint states and odometry stay real-time on a slow link.
 */
const HEAVY_TYPES = new Set(
  [
    'sensor_msgs/Image',
    'sensor_msgs/CompressedImage',
    'sensor_msgs/PointCloud2',
    'nav_msgs/OccupancyGrid',
    'nav2_msgs/Costmap',
    'map_msgs/OccupancyGridUpdate',
    'foxglove_msgs/CompressedVideo',
    'foxglove_msgs/RawImage',
    'foxglove_msgs/CompressedImage',
    'foxglove_msgs/PointCloud',
  ].map(normalizeMessageType)
);
export const isHeavyType = (type: string) => HEAVY_TYPES.has(normalizeMessageType(type));

/**
 * `synchronized`: one connection, panels show the same moment (as Foxglove does).
 * `separate`: heavy topics on their own connections, robot motion first on slow links.
 */
export type StreamMode = 'synchronized' | 'separate';

interface LaneEvents {
  ready: (lane: Lane) => void;
  closed: (lane: Lane, wasReady: boolean) => void;
  advertise: (lane: Lane, channels: Channel[]) => void;
  unadvertise: (lane: Lane, ids: number[]) => void;
  message: (lane: Lane, subscriptionId: number, data: ArrayBufferView) => void;
  services: (services: Service[]) => void;
  unadvertiseServices: (ids: number[]) => void;
  serviceCallResponse: (response: ServiceCallResponse) => void;
  serviceCallFailure: (failure: ServiceCallFailure) => void;
  parameterValues: (values: ParameterValues) => void;
  fetchAssetResponse: (response: FetchAssetResponse) => void;
  schema: (reply: SchemaReply) => void;
  stats: (lane: Lane, report: StatsReport) => void;
  time: (lane: Lane, timestamp: bigint) => void;
  error: (lane: Lane, error: Error) => void;
}

/** One WebSocket to the bridge. Each lane reconnects on its own and knows its own channels. */
class Lane {
  ws: WebSocket | null = null;
  client: ProtocolClient | null = null;
  ready = false;
  serverInfo: ServerInfo | null = null;
  channels = new Map<number, Channel>();
  subscriptionTopics = new Map<number, string>();
  /** Connection attempts that failed in a row; heavy topics fall back to control after a few. */
  failedAttempts = 0;
  /** By channel object: a re-advertised channel, or a subscription's new format, is a new one. */
  private decoders = new WeakMap<Channel, Decoder>();
  private subscriptionChannels = new Map<number, number>();
  /** Subscriptions whose messages a transform changed (miti.subscriptionFormat), as channels. */
  private formats = new Map<number, Channel>();
  private readyWaiters: (() => void)[] = [];
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    readonly name: string,
    private url: string,
    private events: LaneEvents
  ) {}

  connect(): Promise<void> {
    this.shouldReconnect = true;
    return new Promise((resolve, reject) => {
      let opened = false;
      let ws: WebSocket;
      try {
        ws = new WebSocket(this.url, SUBPROTOCOLS);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
        return;
      }
      this.ws = ws;
      const client = new ProtocolClient({ ws });
      this.client = client;
      const events = this.events;
      // The bridge sends serverInfo right after the socket opens; capabilities are known from then.
      client.on('serverInfo', (info) => {
        this.serverInfo = info;
        if (opened) return;
        opened = true;
        this.ready = true;
        this.failedAttempts = 0;
        this.readyWaiters.splice(0).forEach((wake) => wake());
        if (client.isMiti && info.capabilities.includes('miti.stats'))
          client.subscribeStats(STATS_INTERVAL_MS);
        events.ready(this);
        resolve();
      });
      client.on('advertise', (channels) => {
        channels.forEach((channel) => this.channels.set(channel.id, channel));
        events.advertise(this, channels);
      });
      client.on('unadvertise', (ids) => {
        ids.forEach((id) => this.channels.delete(id));
        events.unadvertise(this, ids);
      });
      // Sent before the first message in the new format, on the same socket.
      client.on(
        'subscriptionFormat',
        ({ subscriptionId, encoding, schemaName, schemaEncoding, schema }) => {
          const channel = this.channels.get(this.subscriptionChannels.get(subscriptionId) ?? -1);
          if (!channel) return;
          // Back to the channel's own format when the transform is removed.
          if (channel.schemaName === schemaName && channel.schema === schema)
            this.formats.delete(subscriptionId);
          else
            this.formats.set(subscriptionId, {
              ...channel,
              encoding,
              schemaName,
              schemaEncoding,
              schema,
            });
        }
      );
      client.on('stats', (report) => events.stats(this, report));
      client.on('message', ({ subscriptionId, data }) =>
        events.message(this, subscriptionId, data)
      );
      client.on('advertiseServices', events.services);
      client.on('unadvertiseServices', events.unadvertiseServices);
      client.on('serviceCallResponse', events.serviceCallResponse);
      client.on('serviceCallFailure', events.serviceCallFailure);
      client.on('parameterValues', events.parameterValues);
      client.on('fetchAssetResponse', events.fetchAssetResponse);
      client.on('schema', events.schema);
      client.on('time', ({ timestamp }) => events.time(this, timestamp));
      client.on('status', (status) => {
        if (status.level === StatusLevel.ERROR) events.error(this, new Error(status.message));
        else if (status.level === StatusLevel.WARNING) console.warn('Bridge:', status.message);
      });
      client.on('error', (error) => {
        const err = error instanceof Error ? error : new Error('WebSocket error');
        events.error(this, err);
        if (!opened) reject(err);
      });
      client.on('close', () => {
        if (this.client !== client) return;
        const wasReady = this.ready;
        this.reset();
        if (!opened) {
          this.failedAttempts += 1;
          reject(new Error(`Cannot connect to the bridge at ${this.url}`));
        }
        events.closed(this, wasReady);
        if (this.shouldReconnect) this.scheduleReconnect();
      });
    });
  }

  close(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const client = this.client;
    const wasReady = this.ready;
    this.client = null;
    this.reset();
    client?.close();
    if (wasReady) this.events.closed(this, true);
  }

  /** Resolves once the lane is ready (immediately if it already is). */
  whenReady(): Promise<void> {
    return this.ready ? Promise.resolve() : new Promise((wake) => this.readyWaiters.push(wake));
  }

  subscribe(channelId: number, topic: string): number {
    const id = this.client!.subscribe(channelId);
    this.subscriptionTopics.set(id, topic);
    this.subscriptionChannels.set(id, channelId);
    return id;
  }

  unsubscribe(subscriptionId: number): void {
    this.forget(subscriptionId);
    this.client?.unsubscribe(subscriptionId);
  }

  /** Drops what is known about a subscription the server ended, as with a removed channel. */
  forget(subscriptionId: number): void {
    this.subscriptionTopics.delete(subscriptionId);
    this.subscriptionChannels.delete(subscriptionId);
    this.formats.delete(subscriptionId);
  }

  /** What a subscription's messages are now: its channel, or the format a transform gave them. */
  channelOf(subscriptionId: number): Channel | undefined {
    return (
      this.formats.get(subscriptionId) ??
      this.channels.get(this.subscriptionChannels.get(subscriptionId) ?? -1)
    );
  }

  decode(channel: Channel, data: ArrayBufferView): unknown {
    let decoder = this.decoders.get(channel);
    if (!decoder) {
      decoder = createDecoder(channel.encoding, channel.schemaEncoding, channel.schema);
      this.decoders.set(channel, decoder);
    }
    return decoder(data);
  }

  private reset(): void {
    this.ready = false;
    this.serverInfo = null;
    this.ws = null;
    this.channels.clear();
    this.decoders = new WeakMap();
    this.subscriptionTopics.clear();
    this.subscriptionChannels.clear();
    this.formats.clear();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {
        /* close schedules the next attempt */
      });
    }, RECONNECT_MS);
  }
}

interface TopicSubscription {
  /** Each subscriber's maximum rate (Hz), throttle window (ms) and transform; undefined: none. */
  callbacks: Map<MessageCallback, { maxRate?: number; throttleMs?: number; transform?: Transform }>;
  /** Type requested by the first subscriber; channels of another type are not subscribed. */
  type?: string;
  binding?: { lane: Lane; channelId: number; subscriptionId: number };
  /** When a rate-limited topic last delivered a message. */
  lastDelivered?: number;
  /** The maxRate the server was asked for (miti.bridge.v1); null for none, undefined if never. */
  serverRate?: number | null;
  /** The transform the server was asked for, by key; '' for none, undefined if never. */
  serverTransform?: string;
  /** The encoding of the topic's raw images, once one arrived: JPEG holds only some. */
  imageEncoding?: string;
  /** A message of this topic is being decoded in a worker. */
  decoding?: boolean;
  /** When the last message started decoding, for the subscribers' throttle window. */
  lastStarted?: number;
  /**
   * The newest message that arrived while one was decoding or within the throttle window; it
   * replaced any older one, which was never decoded.
   */
  queued?: MessageJob;
  /** Decodes the queued message when the throttle window closes. */
  timer?: ReturnType<typeof setTimeout>;
}

interface MessageJob {
  lane: Lane;
  subscriptionId: number;
  channel: Channel;
  data: ArrayBufferView;
}

interface Pending<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Client for the robot's bridge: miti_bridge (the MITI protocol, miti.bridge.v1), or
 * foxglove_bridge (the Foxglove WebSocket protocol) on robots that still run it. Messages arrive
 * as CDR and are decoded with the schemas the bridge advertises.
 *
 * The bridge sends each client's messages in order. In the default `synchronized` stream mode
 * every topic shares one connection, as in the Foxglove app: messages arrive in the order the
 * robot produced them, so cameras, TF and the 3D scene show the same moment (late together on a
 * slow link). In `separate` mode every heavy topic (images, point clouds, maps) gets a connection
 * of its own: TF and robot motion stay real-time and a point cloud is not queued behind camera
 * frames, but panels drift apart in time. Robot asset downloads always use their own connection,
 * so megabytes of mesh never delay live data.
 *
 * Subscriptions are shared per topic and survive reconnects and node restarts: they bind to a
 * channel whenever the bridge advertises the topic. A subscriber may cap how often it is called
 * (`maxRate`). miti_bridge applies the limit itself, so the messages never cross the network.
 * foxglove_bridge cannot: messages arriving sooner are dropped here, before decoding, and the
 * subscription is never paused to emulate a limit (measured against a robot, resubscribing between
 * frames lost more frames than it saved bandwidth). Over miti_bridge, subscribers may also ask for
 * a transform (JPEG images, reduced point clouds), and the client reports the link's stats.
 *
 * Heavy messages (images, point clouds, maps) are decoded in Web Workers where the platform has
 * them, together with the per-pixel and per-point work their panels need (see `DecodePool`), so a
 * stream of camera frames does not take the main thread from rendering and input. One message per
 * topic is decoded at a time; while it is, a newer message replaces any waiting one, so a topic
 * that arrives faster than it can be decoded shows its newest frames instead of falling behind.
 */
export class BridgeClient {
  private control: Lane;
  private lanes = new Map<string, Lane>();
  private idleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private events: LaneEvents;
  private connected = false;
  private serverTime: number | null = null;

  private subscriptions = new Map<string, TopicSubscription>();
  private retainedTfTopics = new Set<string>();
  private staticTransformCache = new Map<string, Map<string, unknown>>();

  private services = new Map<string, Service>();
  private publishTypes = new Map<string, string>();
  private clientChannels = new Map<string, number>();
  /** miti.bridge.v1 publishes CDR: each type's encoder, from its schema. */
  private encoders = new Map<string, Encoder>();
  /** Types whose schema was asked for (miti.getSchema), with what waits to be published. */
  private schemaWaits = new Map<string, { topic: string; message: unknown }[]>();
  private nextRequestId = 1;
  private serviceCalls = new Map<number, Pending<unknown> & { service: Service }>();
  private parameterRequests = new Map<string, Pending<unknown>>();
  private assetRequests = new Map<number, Pending<Uint8Array<ArrayBuffer>>>();
  /** One request per URI per session: visuals and collisions share meshes, and reloads reuse them. */
  private assetCache = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
  private assetQueue: { start: () => void; reject: (error: Error) => void }[] = [];
  private assetsInFlight = 0;

  /** Each connection's latest miti.stats report. */
  private statsReports = new Map<Lane, StatsReport>();
  private linkStats: LinkStats | null = null;
  private statsCallbacks = new Set<(stats: LinkStats | null) => void>();

  private connectionCallbacks = new Set<ConnectionCallback>();
  private disconnectionCallbacks = new Set<ConnectionCallback>();
  private errorCallbacks = new Set<ErrorCallback>();
  private topicCallbacks = new Set<(topics: TopicInfo[]) => void>();

  private separateHeavyTopics: boolean;
  /** Created on the first heavy message; null where workers are unavailable or switched off. */
  private decodePool: DecodePool | null | undefined;
  private createWorker?: () => Worker;

  constructor(
    private url: string,
    options: {
      streamMode?: StreamMode;
      /** Decode heavy messages in Web Workers when the platform has them (default true). */
      decodeInWorkers?: boolean;
      /** Worker factory, for tests; defaults to the bundled decode worker. */
      createWorker?: () => Worker;
    } = {}
  ) {
    this.separateHeavyTopics = options.streamMode === 'separate';
    if (options.decodeInWorkers === false) this.decodePool = null;
    this.createWorker = options.createWorker;
    const events: LaneEvents = {
      ready: (lane) => this.handleReady(lane),
      closed: (lane, wasReady) => this.handleClosed(lane, wasReady),
      advertise: (lane) => {
        this.bindAll();
        if (lane === this.control) this.emitTopics();
      },
      unadvertise: (lane, ids) => this.handleUnadvertise(lane, ids),
      message: (lane, subscriptionId, data) => this.handleMessage(lane, subscriptionId, data),
      services: (services) =>
        services.forEach((service) => this.services.set(service.name, service)),
      unadvertiseServices: (ids) =>
        this.services.forEach((service, name) => {
          if (ids.includes(service.id)) this.services.delete(name);
        }),
      serviceCallResponse: (response) => this.handleServiceResponse(response),
      serviceCallFailure: (failure) =>
        this.take(this.serviceCalls, failure.callId)?.reject(new Error(failure.message)),
      parameterValues: ({ parameters, id }) => {
        const pending = id ? this.take(this.parameterRequests, id) : undefined;
        if (!pending) return;
        if (parameters.length) pending.resolve(parameters[0].value);
        else pending.reject(new Error('Parameter not found'));
      },
      fetchAssetResponse: (response) => this.handleAssetResponse(response),
      schema: (reply) => this.handleSchema(reply),
      stats: (lane, report) => {
        this.statsReports.set(lane, report);
        this.updateLinkStats();
      },
      time: (lane, timestamp) => {
        if (lane === this.control) this.serverTime = Number(timestamp) / 1e9;
      },
      error: (lane, error) => {
        // Per-topic connections are an optimisation; their failures do not make the bridge
        // unavailable.
        if (lane === this.control) this.errorCallbacks.forEach((cb) => cb(error));
        else console.warn(`Bridge connection for ${lane.name}:`, error.message);
      },
    };
    this.events = events;
    this.control = new Lane('control', url, events);
  }

  connect(): Promise<void> {
    return this.control.connect();
  }

  disconnect(): void {
    this.decodePool?.dispose();
    if (this.decodePool) this.decodePool = undefined;
    this.control.close();
    this.lanes.forEach((lane) => lane.close());
    this.lanes.clear();
    this.idleTimers.forEach(clearTimeout);
    this.idleTimers.clear();
  }

  /** The robot's clock (simulation time when it runs on sim time), in seconds, if the bridge sends it. */
  getServerTime(): number | null {
    return this.serverTime;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /** Whether the bridge speaks the MITI protocol (miti_bridge) rather than foxglove_bridge's. */
  usesMitiProtocol(): boolean {
    return this.connected && (this.control.client?.isMiti ?? false);
  }

  /** The bridge MITI is connected to, by name; null while disconnected. */
  getBridgeName(): string | null {
    if (!this.connected) return null;
    return this.usesMitiProtocol()
      ? (this.control.serverInfo?.name ?? 'miti_bridge')
      : 'foxglove_bridge';
  }

  /** How the link to miti_bridge is doing; null with foxglove_bridge or before its first report. */
  getLinkStats(): LinkStats | null {
    return this.linkStats;
  }

  onLinkStats(callback: (stats: LinkStats | null) => void): () => void {
    this.statsCallbacks.add(callback);
    return () => this.statsCallbacks.delete(callback);
  }

  hasCapability(capability: string): boolean {
    return this.control.serverInfo?.capabilities.includes(capability) ?? false;
  }

  // ── Topics ──

  getTopics(): TopicInfo[] {
    const topics = new Map<string, TopicInfo>();
    this.control.channels.forEach((channel) => {
      if (!topics.has(channel.topic))
        topics.set(channel.topic, { topic: channel.topic, type: channel.schemaName });
    });
    return Array.from(topics.values()).sort((a, b) => a.topic.localeCompare(b.topic));
  }

  onTopicsChanged(callback: (topics: TopicInfo[]) => void): () => void {
    this.topicCallbacks.add(callback);
    return () => this.topicCallbacks.delete(callback);
  }

  subscribe(
    topic: string,
    callback: MessageCallback,
    type?: string,
    options?: SubscribeOptions
  ): void {
    if (options?.retainTransforms) this.retainedTfTopics.add(topic);
    let subscription = this.subscriptions.get(topic);
    if (!subscription) {
      subscription = { callbacks: new Map(), type };
      this.subscriptions.set(topic, subscription);
    }
    subscription.callbacks.set(callback, {
      maxRate: options?.maxRate && options.maxRate > 0 ? options.maxRate : undefined,
      throttleMs: options?.throttleMs && options.throttleMs > 0 ? options.throttleMs : undefined,
      transform: options?.transform,
    });
    this.bind(topic);
    this.sendServerOptions(subscription);
    const cached = this.staticTransformCache.get(topic);
    if (cached?.size) callback({ transforms: Array.from(cached.values()) });
  }

  unsubscribe(topic: string, callback?: MessageCallback): void {
    const subscription = this.subscriptions.get(topic);
    if (!subscription) return;
    if (callback) subscription.callbacks.delete(callback);
    if (callback && subscription.callbacks.size > 0) {
      this.sendServerOptions(subscription);
      return;
    }
    this.unbind(subscription);
    this.subscriptions.delete(topic);
    if (this.lanes.has(topic)) this.closeWhenIdle(topic);
  }

  // ── Publishing ──

  /** Declare a topic to publish on; repeated calls are free and it survives reconnects. */
  advertise(topic: string, type: string): void {
    this.publishTypes.set(topic, ros2TypeName(type));
  }

  /**
   * Publish a message on a topic declared with `advertise()`. foxglove_bridge takes it as JSON.
   * miti_bridge takes CDR: the message is encoded with the type's schema, which the bridge sends
   * with the topic's channel or, the first time for a type it does not advertise, on request; the
   * message waits for it, and a failure then reaches the error callbacks.
   */
  publish(topic: string, message: unknown): void {
    const client = this.control.client;
    if (!client || !this.connected) throw new Error('Not connected to the bridge');
    if (!this.hasCapability('clientPublish'))
      throw new Error('The bridge does not allow publishing (clientPublish disabled)');
    if (client.isMiti) {
      this.publishCdr(client, topic, message);
      return;
    }
    if (!this.control.serverInfo?.supportedEncodings?.includes('json'))
      throw new Error('foxglove_bridge does not accept JSON messages');
    let channelId = this.clientChannels.get(topic);
    if (channelId === undefined) {
      const schemaName = this.publishTypes.get(topic);
      if (!schemaName) throw new Error(`Call advertise() before publishing on ${topic}`);
      channelId = client.advertise({ topic, encoding: 'json', schemaName });
      this.clientChannels.set(topic, channelId);
    }
    client.sendMessage(channelId, textEncoder.encode(JSON.stringify(message)));
  }

  private publishCdr(client: ProtocolClient, topic: string, message: unknown): void {
    const type = this.publishTypes.get(topic);
    if (!type) throw new Error(`Call advertise() before publishing on ${topic}`);
    const key = normalizeMessageType(type);
    if (!this.encoders.has(key)) {
      const advertised = Array.from(this.control.channels.values()).find(
        (channel) =>
          normalizeMessageType(channel.schemaName) === key &&
          channel.encoding === 'cdr' &&
          (channel.schemaEncoding ?? 'ros2msg') === 'ros2msg'
      );
      if (advertised) this.encoders.set(key, createEncoder(advertised.schema));
    }
    const encoder = this.encoders.get(key);
    if (!encoder) {
      if (!this.hasCapability('miti.schemas'))
        throw new Error(`Cannot publish ${type}: the bridge does not look up schemas`);
      const waiting = this.schemaWaits.get(key);
      if (waiting) waiting.push({ topic, message });
      else {
        this.schemaWaits.set(key, [{ topic, message }]);
        client.getSchema(type, `schema-${this.nextRequestId++}`);
      }
      return;
    }
    let channelId = this.clientChannels.get(topic);
    if (channelId === undefined) {
      channelId = client.advertise({ topic, encoding: 'cdr', schemaName: type });
      this.clientChannels.set(topic, channelId);
    }
    client.sendMessage(channelId, encoder(message));
  }

  private handleSchema(reply: SchemaReply): void {
    const key = normalizeMessageType(reply.type);
    const waiting = this.schemaWaits.get(key) ?? [];
    this.schemaWaits.delete(key);
    const fail = (error: Error) => this.errorCallbacks.forEach((cb) => cb(error));
    if (reply.error || reply.schema === undefined) {
      fail(new Error(`Cannot publish ${reply.type}: ${reply.error ?? 'no schema'}`));
      return;
    }
    try {
      this.encoders.set(key, createEncoder(reply.schema));
    } catch (error) {
      fail(new Error(`Cannot publish ${reply.type}: ${(error as Error).message}`));
      return;
    }
    for (const { topic, message } of waiting) {
      try {
        this.publish(topic, message);
      } catch (error) {
        fail(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  // ── Services, parameters and assets ──

  callService(name: string, args: unknown = {}): Promise<unknown> {
    const client = this.control.client;
    if (!client || !this.connected) return Promise.reject(new Error('Not connected to the bridge'));
    const service = this.services.get(name);
    if (!service) return Promise.reject(new Error(`Service ${name} is not available`));
    let data: Uint8Array;
    try {
      data = createEncoder(service.request?.schema ?? service.requestSchema ?? '')(args);
    } catch (error) {
      return Promise.reject(
        new Error(`Invalid request for ${name}: ${error instanceof Error ? error.message : error}`)
      );
    }
    const callId = this.nextRequestId++;
    const promise = this.track(this.serviceCalls, callId, `Service call timeout: ${name}`, {
      service,
    });
    client.sendServiceCallRequest({ serviceId: service.id, callId, encoding: 'cdr', data });
    return promise;
  }

  /** Read a ROS parameter, named `/node.parameter`. */
  getParameter(name: string): Promise<unknown> {
    const client = this.control.client;
    if (!client || !this.connected) return Promise.reject(new Error('Not connected to the bridge'));
    if (!this.hasCapability('parameters'))
      return Promise.reject(new Error('The bridge does not expose parameters'));
    const id = `parameter-${this.nextRequestId++}`;
    const promise = this.track(this.parameterRequests, id, `Parameter timeout: ${name}`);
    client.getParameters([name], id);
    return promise;
  }

  /** Fetch a `package://` or `file://` resource from the robot, as the bridge resolves it. */
  fetchAsset(uri: string): Promise<Uint8Array<ArrayBuffer>> {
    if (!this.control.client || !this.connected)
      return Promise.reject(new Error('Not connected to the bridge'));
    if (!this.hasCapability('assets'))
      return Promise.reject(new Error('The bridge does not serve assets'));
    let request = this.assetCache.get(uri);
    if (!request) {
      request = this.loadAsset(uri);
      this.assetCache.set(uri, request);
      request.catch(() => this.assetCache.delete(uri));
    }
    return request;
  }

  /** Forget fetched assets, in memory and in the browser cache, e.g. after a URDF changes. */
  async clearAssetCache(): Promise<void> {
    this.assetCache.clear();
    await clearCachedAssets();
  }

  // ── Events ──

  onConnection(callback: ConnectionCallback): () => void {
    this.connectionCallbacks.add(callback);
    return () => this.connectionCallbacks.delete(callback);
  }

  onDisconnection(callback: ConnectionCallback): () => void {
    this.disconnectionCallbacks.add(callback);
    return () => this.disconnectionCallbacks.delete(callback);
  }

  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  // ── Subscription binding ──

  private maxRate(subscription: TopicSubscription): number | undefined {
    let rate = 0;
    for (const { maxRate } of Array.from(subscription.callbacks.values())) {
      if (maxRate === undefined) return undefined;
      rate = Math.max(rate, maxRate);
    }
    return rate || undefined;
  }

  /**
   * The rate the server may send a topic at, so messages no subscriber shows do not cross the
   * network: the highest of the subscribers' limits, each the lower of its maxRate and one message
   * per throttle window. Undefined when a subscriber wants every message.
   */
  private serverRate(subscription: TopicSubscription): number | undefined {
    let rate = 0;
    for (const { maxRate, throttleMs } of Array.from(subscription.callbacks.values())) {
      const limit = Math.min(maxRate ?? Infinity, throttleMs ? 1000 / throttleMs : Infinity);
      if (!Number.isFinite(limit)) return undefined;
      rate = Math.max(rate, limit);
    }
    return rate || undefined;
  }

  /**
   * The transform the server may apply to a topic: the one every subscriber asks for, since all of
   * them receive its output, and only on a channel of the type it takes. `jpeg` also waits for a
   * raw frame in an encoding JPEG can hold.
   */
  private serverTransform(
    subscription: TopicSubscription,
    channel: Channel
  ): Transform | undefined {
    let wanted: Transform | undefined;
    for (const { transform } of Array.from(subscription.callbacks.values())) {
      if (!transform || (wanted && transformKey(wanted) !== transformKey(transform))) return;
      wanted = transform;
    }
    if (!wanted || TRANSFORM_INPUTS[wanted.kind] !== normalizeMessageType(channel.schemaName))
      return;
    if (wanted.kind === 'jpeg' && !JPEG_ENCODINGS.has(subscription.imageEncoding ?? '')) return;
    return wanted;
  }

  /**
   * Over miti.bridge.v1, have the server apply the topic's rate limit and transform; each is sent
   * once per change.
   */
  private sendServerOptions(subscription: TopicSubscription): void {
    const binding = subscription.binding;
    const lane = binding?.lane;
    if (!binding || !lane?.client?.isMiti) return;
    const options: SubscriptionOptions = {};
    const rate = this.serverRate(subscription) ?? null;
    if (subscription.serverRate !== rate && (subscription.serverRate !== undefined || rate))
      options.maxRate = rate;
    const channel = lane.channels.get(binding.channelId);
    const transform =
      channel && lane.serverInfo?.capabilities.includes('miti.transforms')
        ? (this.serverTransform(subscription, channel) ?? null)
        : null;
    const key = transform ? transformKey(transform) : '';
    if (subscription.serverTransform !== key && (subscription.serverTransform !== undefined || key))
      options.transform = transform;
    if (!Object.keys(options).length) return;
    lane.client.setSubscriptionOptions(binding.subscriptionId, options);
    if ('maxRate' in options) subscription.serverRate = rate;
    if ('transform' in options) subscription.serverTransform = key;
  }

  /** Forgets what the server was asked for, when the subscription it applied to ends. */
  private clearServerOptions(subscription: TopicSubscription): void {
    subscription.serverRate = undefined;
    subscription.serverTransform = undefined;
    subscription.imageEncoding = undefined;
  }

  /** The shortest throttle window of the subscribers, in ms; 0 when one wants every message. */
  private throttleMs(subscription: TopicSubscription): number {
    let window = Infinity;
    for (const { throttleMs } of Array.from(subscription.callbacks.values()))
      window = Math.min(window, throttleMs ?? 0);
    return Number.isFinite(window) ? window : 0;
  }

  /** The lane for `key` (a heavy topic, or asset downloads), opened on first use. */
  private laneNamed(key: string): Lane {
    const idle = this.idleTimers.get(key);
    if (idle) clearTimeout(idle);
    this.idleTimers.delete(key);
    let lane = this.lanes.get(key);
    if (!lane) {
      lane = new Lane(key, this.url, this.events);
      this.lanes.set(key, lane);
      lane.connect().catch(() => {
        /* Retried by the lane; the topic falls back to control after repeated failures. */
      });
    }
    return lane;
  }

  private closeWhenIdle(key: string): void {
    const idle = this.idleTimers.get(key);
    if (idle) clearTimeout(idle);
    this.idleTimers.set(
      key,
      setTimeout(() => {
        this.idleTimers.delete(key);
        if (this.subscriptions.has(key)) return;
        this.lanes.get(key)?.close();
        this.lanes.delete(key);
      }, LANE_IDLE_MS)
    );
  }

  /** The lane a topic of this type should use, or null while it is not ready. */
  private laneFor(topic: string, type: string): Lane | null {
    if (!isHeavyType(type) || !this.separateHeavyTopics)
      return this.control.ready ? this.control : null;
    const lane = this.laneNamed(topic);
    if (lane.ready) return lane;
    return lane.failedAttempts >= LANE_FALLBACK_AFTER && this.control.ready ? this.control : null;
  }

  /** Subscribe `topic` on a matching advertised channel, if there is one and it is not bound. */
  private bind(topic: string): void {
    const subscription = this.subscriptions.get(topic);
    if (!subscription || subscription.binding) return;
    const wanted = subscription.type && normalizeMessageType(ros2TypeName(subscription.type));
    const matches = (channel: Channel) =>
      channel.topic === topic && (!wanted || normalizeMessageType(channel.schemaName) === wanted);
    // A channel of another type would decode into the wrong message; the topic list reports it.
    const type = Array.from(this.control.channels.values()).find(matches)?.schemaName;
    const lane = type ? this.laneFor(topic, type) : null;
    const channel = lane && Array.from(lane.channels.values()).find(matches);
    if (!lane || !channel) return;
    subscription.binding = {
      lane,
      channelId: channel.id,
      subscriptionId: lane.subscribe(channel.id, topic),
    };
    this.sendServerOptions(subscription);
  }

  private unbind(subscription: TopicSubscription): void {
    if (subscription.timer) clearTimeout(subscription.timer);
    subscription.timer = undefined;
    subscription.queued = undefined;
    this.clearServerOptions(subscription);
    if (!subscription.binding) return;
    subscription.binding.lane.unsubscribe(subscription.binding.subscriptionId);
    subscription.binding = undefined;
  }

  private bindAll(): void {
    this.subscriptions.forEach((_subscription, topic) => this.bind(topic));
  }

  private handleReady(lane: Lane): void {
    if (lane === this.control) {
      this.connected = true;
      this.connectionCallbacks.forEach((cb) => cb());
      return;
    }
    // A topic that fell back to the control connection moves to its own once it opens.
    const subscription = this.subscriptions.get(lane.name);
    if (subscription?.binding?.lane === this.control) this.unbind(subscription);
    this.bindAll();
  }

  private handleClosed(lane: Lane, wasReady: boolean): void {
    this.subscriptions.forEach((subscription) => {
      if (subscription.binding?.lane !== lane) return;
      subscription.binding = undefined;
      this.clearServerOptions(subscription);
    });
    this.statsReports.delete(lane);
    this.updateLinkStats();
    if (lane !== this.control) {
      this.bindAll();
      return;
    }
    this.serverTime = null;
    // Channels, services and client advertisements belong to one connection.
    this.connected = false;
    this.services.clear();
    this.clientChannels.clear();
    this.encoders.clear();
    this.schemaWaits.clear();
    this.staticTransformCache.clear();
    const fail = (pending: Pending<never>) => {
      clearTimeout(pending.timer);
      pending.reject(new Error('Disconnected from the bridge'));
    };
    this.serviceCalls.forEach(fail);
    this.parameterRequests.forEach(fail);
    this.assetRequests.forEach(fail);
    this.serviceCalls.clear();
    this.parameterRequests.clear();
    this.assetRequests.clear();
    this.assetQueue.forEach(({ reject }) => reject(new Error('Disconnected from the bridge')));
    this.assetQueue = [];
    this.assetsInFlight = 0;
    this.assetCache.clear();
    this.emitTopics();
    if (wasReady) this.disconnectionCallbacks.forEach((cb) => cb());
  }

  private handleUnadvertise(lane: Lane, ids: number[]): void {
    // The bridge drops subscriptions to removed channels; rebind when the topic comes back.
    this.subscriptions.forEach((subscription) => {
      const binding = subscription.binding;
      if (binding?.lane !== lane || !ids.includes(binding.channelId)) return;
      lane.forget(binding.subscriptionId);
      subscription.binding = undefined;
      this.clearServerOptions(subscription);
    });
    this.bindAll();
    if (lane === this.control) this.emitTopics();
  }

  private handleMessage(lane: Lane, subscriptionId: number, data: ArrayBufferView): void {
    const topic = lane.subscriptionTopics.get(subscriptionId);
    const subscription = topic ? this.subscriptions.get(topic) : undefined;
    const binding = subscription?.binding;
    // Messages still in flight after an unsubscribe are ignored.
    if (!topic || !subscription || binding?.subscriptionId !== subscriptionId) return;
    // Where the server applies the limit, a second gate here would drop what it let through early.
    const rate = subscription.serverRate ? undefined : this.maxRate(subscription);
    const now = Date.now();
    const last = subscription.lastDelivered;
    // Sooner than every subscriber's cap: skip it, including the cost of decoding.
    if (rate && last !== undefined && now - last < 1000 / rate) return;
    if (rate) subscription.lastDelivered = now;
    // A transform may have given the subscription's messages another format than the channel's.
    const channel = lane.channelOf(subscriptionId);
    if (channel) this.process(topic, subscription, { lane, subscriptionId, channel, data });
  }

  /**
   * Decode a message now, or keep it as the topic's newest while another is decoding or the
   * subscribers' throttle window is open; a message replaced that way is never decoded.
   */
  private process(topic: string, subscription: TopicSubscription, job: MessageJob): void {
    const wait =
      (subscription.lastStarted ?? -Infinity) + this.throttleMs(subscription) - Date.now();
    if (subscription.decoding || wait > 0) {
      subscription.queued = job;
      if (!subscription.decoding && !subscription.timer)
        subscription.timer = setTimeout(() => {
          subscription.timer = undefined;
          this.processQueued(topic, subscription);
        }, wait);
      return;
    }
    subscription.lastStarted = Date.now();
    const pool = isHeavyType(job.channel.schemaName) ? this.workers() : null;
    if (!pool) {
      let message: unknown;
      try {
        message = job.lane.decode(job.channel, job.data);
      } catch (error) {
        console.error(`Cannot decode ${topic}:`, error);
        return;
      }
      this.deliver(topic, subscription, message);
      return;
    }
    subscription.decoding = true;
    pool
      .decode(job.channel, job.data)
      .then(
        (message) => {
          if (this.isCurrent(topic, subscription, job)) this.deliver(topic, subscription, message);
        },
        (error) => {
          if (!(error instanceof DecodePoolFailure))
            console.error(`Cannot decode ${topic}:`, error);
        }
      )
      .finally(() => {
        subscription.decoding = false;
        this.processQueued(topic, subscription);
      });
  }

  private processQueued(topic: string, subscription: TopicSubscription): void {
    const job = subscription.queued;
    subscription.queued = undefined;
    if (job && this.isCurrent(topic, subscription, job)) this.process(topic, subscription, job);
  }

  private deliver(topic: string, subscription: TopicSubscription, message: unknown): void {
    this.retainTransforms(topic, message);
    // A raw image's encoding decides whether the bridge may send the topic as JPEG.
    const encoding = (message as { encoding?: unknown } | null)?.encoding;
    if (typeof encoding === 'string' && encoding !== subscription.imageEncoding) {
      subscription.imageEncoding = encoding;
      this.sendServerOptions(subscription);
    }
    subscription.callbacks.forEach((_options, cb) => cb(message));
  }

  /** Sums each connection's latest report into one view of the link. */
  private updateLinkStats(): void {
    const seconds = STATS_INTERVAL_MS / 1000;
    const topics = new Map<string, LinkStats['topics'][number]>();
    const stats: LinkStats = {
      bytesPerSecond: 0,
      droppedPerSecond: 0,
      bufferedBytes: 0,
      oldestQueuedMs: 0,
      topics: [],
    };
    this.statsReports.forEach((report, lane) => {
      stats.bufferedBytes += report.bufferedBytes;
      report.subscriptions.forEach((entry) => {
        stats.bytesPerSecond += entry.bytesPerSecond;
        stats.droppedPerSecond += entry.dropped / seconds;
        stats.oldestQueuedMs = Math.max(stats.oldestQueuedMs, entry.oldestQueuedMs);
        const topic = lane.subscriptionTopics.get(entry.subscriptionId);
        if (!topic) return;
        const row = topics.get(topic) ?? {
          topic,
          bytesPerSecond: 0,
          sentPerSecond: 0,
          droppedPerSecond: 0,
        };
        row.bytesPerSecond += entry.bytesPerSecond;
        row.sentPerSecond += entry.sent / seconds;
        row.droppedPerSecond += entry.dropped / seconds;
        topics.set(topic, row);
      });
    });
    stats.topics = Array.from(topics.values()).sort((a, b) => b.bytesPerSecond - a.bytesPerSecond);
    this.linkStats = this.statsReports.size ? stats : null;
    this.statsCallbacks.forEach((cb) => cb(this.linkStats));
  }

  /** The decode workers, started on first use; null where they are unavailable. */
  private workers(): DecodePool | null {
    if (this.decodePool === undefined)
      this.decodePool = DecodePool.create((error) => {
        console.warn('Decode workers stopped; decoding on the main thread:', error.message);
        this.decodePool = null;
      }, this.createWorker);
    return this.decodePool?.available ? this.decodePool : null;
  }

  /** Whether a message still belongs to the topic's current subscription. */
  private isCurrent(topic: string, subscription: TopicSubscription, job: MessageJob): boolean {
    const binding = subscription.binding;
    return (
      this.subscriptions.get(topic) === subscription &&
      binding?.lane === job.lane &&
      binding.subscriptionId === job.subscriptionId
    );
  }

  /** Static transforms are latched: later scenes must still receive those already received. */
  private retainTransforms(topic: string, message: unknown): void {
    if (!(topic.includes('static') || this.retainedTfTopics.has(topic))) return;
    const transforms = (message as { transforms?: unknown })?.transforms;
    if (!Array.isArray(transforms)) return;
    const cached = this.staticTransformCache.get(topic) ?? new Map<string, unknown>();
    for (const transform of transforms) {
      const child = (transform as { child_frame_id?: unknown })?.child_frame_id;
      if (typeof child === 'string') cached.set(child, transform);
    }
    this.staticTransformCache.set(topic, cached);
  }

  // ── Requests ──

  private handleServiceResponse(response: ServiceCallResponse): void {
    const pending = this.take(this.serviceCalls, response.callId);
    if (!pending) return;
    try {
      const schema = pending.service.response?.schema ?? pending.service.responseSchema ?? '';
      pending.resolve(
        createDecoder(
          response.encoding,
          pending.service.response?.schemaEncoding,
          schema
        )(response.data)
      );
    } catch (error) {
      pending.reject(error instanceof Error ? error : new Error('Invalid service response'));
    }
  }

  private handleAssetResponse(response: FetchAssetResponse): void {
    const pending = this.take(this.assetRequests, response.requestId);
    if (!pending) return;
    if (response.status === FetchAssetStatus.SUCCESS) {
      const { buffer, byteOffset, byteLength } = response.data;
      const bytes = new Uint8Array(byteLength);
      bytes.set(new Uint8Array(buffer, byteOffset, byteLength));
      pending.resolve(bytes);
    } else pending.reject(new Error(response.error));
  }

  private async loadAsset(uri: string): Promise<Uint8Array<ArrayBuffer>> {
    const cached = await readCachedAsset(this.url, uri);
    if (cached) return cached;
    let lastError: unknown;
    for (let attempt = 1; attempt <= ASSET_ATTEMPTS; attempt++) {
      try {
        const bytes = await this.queueAsset(uri);
        void writeCachedAsset(this.url, uri, bytes);
        return bytes;
      } catch (error) {
        lastError = error;
        if (!(error instanceof Error && /timeout/i.test(error.message)) || !this.connected) break;
      }
    }
    throw lastError;
  }

  /** Fetch an asset, a few at a time. */
  private queueAsset(uri: string): Promise<Uint8Array<ArrayBuffer>> {
    return new Promise((resolve, reject) => {
      const start = () => {
        this.assetsInFlight += 1;
        const requestId = this.nextRequestId++;
        this.track(
          this.assetRequests,
          requestId,
          `Asset timeout: ${uri}`,
          undefined,
          ASSET_TIMEOUT_MS
        )
          .then(resolve, reject)
          .finally(() => {
            this.assetsInFlight = Math.max(0, this.assetsInFlight - 1);
            this.assetQueue.shift()?.start();
          });
        // Downloads use a connection of their own, so megabytes of mesh never delay TF.
        const lane = this.laneNamed(ASSETS_LANE);
        const send = () => (lane.ready ? lane : this.control).client?.fetchAsset(uri, requestId);
        if (lane.ready) send();
        else
          Promise.race([
            lane.whenReady(),
            new Promise((wait) => setTimeout(wait, REQUEST_TIMEOUT_MS)),
          ]).then(send);
      };
      if (this.assetsInFlight < MAX_ASSETS_IN_FLIGHT) start();
      else this.assetQueue.push({ start, reject });
    });
  }

  private track<K, T>(
    map: Map<K, Pending<T>>,
    key: K,
    timeoutMessage: string,
    extra?: object,
    timeoutMs = REQUEST_TIMEOUT_MS
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        map.delete(key);
        reject(new Error(timeoutMessage));
      }, timeoutMs);
      map.set(key, { resolve, reject, timer, ...extra } as Pending<T>);
    });
  }

  private take<K, V extends { timer: ReturnType<typeof setTimeout> }>(
    map: Map<K, V>,
    key: K
  ): V | undefined {
    const pending = map.get(key);
    if (!pending) return undefined;
    clearTimeout(pending.timer);
    map.delete(key);
    return pending;
  }

  private emitTopics(): void {
    const topics = this.getTopics();
    this.topicCallbacks.forEach((cb) => cb(topics));
  }
}
