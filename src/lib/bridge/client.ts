import {
  FetchAssetStatus,
  FoxgloveClient,
  StatusLevel,
  type Channel,
  type FetchAssetResponse,
  type ParameterValues,
  type ServerInfo,
  type Service,
  type ServiceCallFailure,
  type ServiceCallResponse,
} from '@foxglove/ws-protocol';
import { clearCachedAssets, readCachedAsset, writeCachedAsset } from './asset-cache';
import { createDecoder, createEncoder, ros2TypeName, type Decoder } from './codec';
import { normalizeMessageType } from './topics';
import type {
  ConnectionCallback,
  ErrorCallback,
  MessageCallback,
  SubscribeOptions,
  TopicInfo,
} from './types';

/** foxglove_bridge ≥ 3 (Foxglove SDK) speaks `foxglove.sdk.v1`; older bridges the v1 name. */
const SUBPROTOCOLS = ['foxglove.sdk.v1', 'foxglove.websocket.v1'];
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
const textEncoder = new TextEncoder();

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
  time: (lane: Lane, timestamp: bigint) => void;
  error: (lane: Lane, error: Error) => void;
}

/** One WebSocket to the bridge. Each lane reconnects on its own and knows its own channels. */
class Lane {
  ws: WebSocket | null = null;
  client: FoxgloveClient | null = null;
  ready = false;
  serverInfo: ServerInfo | null = null;
  channels = new Map<number, Channel>();
  subscriptionTopics = new Map<number, string>();
  /** Connection attempts that failed in a row; heavy topics fall back to control after a few. */
  failedAttempts = 0;
  private decoders = new Map<number, Decoder>();
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
      const client = new FoxgloveClient({ ws });
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
        events.ready(this);
        resolve();
      });
      client.on('advertise', (channels) => {
        channels.forEach((channel) => {
          this.channels.set(channel.id, channel);
          this.decoders.delete(channel.id);
        });
        events.advertise(this, channels);
      });
      client.on('unadvertise', (ids) => {
        ids.forEach((id) => {
          this.channels.delete(id);
          this.decoders.delete(id);
        });
        events.unadvertise(this, ids);
      });
      client.on('message', ({ subscriptionId, data }) =>
        events.message(this, subscriptionId, data)
      );
      client.on('advertiseServices', events.services);
      client.on('unadvertiseServices', events.unadvertiseServices);
      client.on('serviceCallResponse', events.serviceCallResponse);
      client.on('serviceCallFailure', events.serviceCallFailure);
      client.on('parameterValues', events.parameterValues);
      client.on('fetchAssetResponse', events.fetchAssetResponse);
      client.on('time', ({ timestamp }) => events.time(this, timestamp));
      client.on('status', (status) => {
        if (status.level === StatusLevel.ERROR) events.error(this, new Error(status.message));
        else if (status.level === StatusLevel.WARNING)
          console.warn('foxglove_bridge:', status.message);
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
          reject(new Error(`Cannot connect to foxglove_bridge at ${this.url}`));
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
    return id;
  }

  unsubscribe(subscriptionId: number): void {
    this.subscriptionTopics.delete(subscriptionId);
    this.client?.unsubscribe(subscriptionId);
  }

  decode(channelId: number, data: ArrayBufferView): unknown {
    let decoder = this.decoders.get(channelId);
    if (!decoder) {
      const channel = this.channels.get(channelId)!;
      decoder = createDecoder(channel.encoding, channel.schemaEncoding, channel.schema);
      this.decoders.set(channelId, decoder);
    }
    return decoder(data);
  }

  private reset(): void {
    this.ready = false;
    this.serverInfo = null;
    this.ws = null;
    this.channels.clear();
    this.decoders.clear();
    this.subscriptionTopics.clear();
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
  /** Each subscriber's maximum rate in Hz; undefined means every message. */
  callbacks: Map<MessageCallback, number | undefined>;
  /** Type requested by the first subscriber; channels of another type are not subscribed. */
  type?: string;
  binding?: { lane: Lane; channelId: number; subscriptionId: number };
  /** When a rate-limited topic last delivered a message. */
  lastDelivered?: number;
}

interface Pending<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Client for foxglove_bridge (the Foxglove WebSocket protocol). Messages arrive as CDR and are
 * decoded with the schemas the bridge advertises.
 *
 * The bridge queues each client's messages in order. In the default `synchronized` stream mode
 * every topic shares one connection, as in the Foxglove app: messages arrive in the order the
 * robot produced them, so cameras, TF and the 3D scene show the same moment (late together on a
 * slow link). In `separate` mode every heavy topic (images, point clouds, maps) gets a connection
 * of its own: TF and robot motion stay real-time and a point cloud is not queued behind camera
 * frames, but panels drift apart in time. Robot asset downloads always use their own connection,
 * so megabytes of mesh never delay live data.
 *
 * Subscriptions are shared per topic and survive reconnects and node restarts: they bind to a
 * channel whenever the bridge advertises the topic. A subscriber may cap how often it is called
 * (`maxRate`); messages arriving sooner are dropped before decoding. The protocol has no
 * server-side throttling, and the subscription is never paused to emulate one: measured against a
 * robot, resubscribing between frames lost more frames than it saved bandwidth.
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
  private nextRequestId = 1;
  private serviceCalls = new Map<number, Pending<unknown> & { service: Service }>();
  private parameterRequests = new Map<string, Pending<unknown>>();
  private assetRequests = new Map<number, Pending<Uint8Array<ArrayBuffer>>>();
  /** One request per URI per session: visuals and collisions share meshes, and reloads reuse them. */
  private assetCache = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
  private assetQueue: { start: () => void; reject: (error: Error) => void }[] = [];
  private assetsInFlight = 0;

  private connectionCallbacks = new Set<ConnectionCallback>();
  private disconnectionCallbacks = new Set<ConnectionCallback>();
  private errorCallbacks = new Set<ErrorCallback>();
  private topicCallbacks = new Set<(topics: TopicInfo[]) => void>();

  private separateHeavyTopics: boolean;

  constructor(
    private url: string,
    options: { streamMode?: StreamMode } = {}
  ) {
    this.separateHeavyTopics = options.streamMode === 'separate';
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
      time: (lane, timestamp) => {
        if (lane === this.control) this.serverTime = Number(timestamp) / 1e9;
      },
      error: (lane, error) => {
        // Per-topic connections are an optimisation; their failures do not make the bridge
        // unavailable.
        if (lane === this.control) this.errorCallbacks.forEach((cb) => cb(error));
        else console.warn(`foxglove_bridge connection for ${lane.name}:`, error.message);
      },
    };
    this.events = events;
    this.control = new Lane('control', url, events);
  }

  connect(): Promise<void> {
    return this.control.connect();
  }

  disconnect(): void {
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
    subscription.callbacks.set(
      callback,
      options?.maxRate && options.maxRate > 0 ? options.maxRate : undefined
    );
    this.bind(topic);
    const cached = this.staticTransformCache.get(topic);
    if (cached?.size) callback({ transforms: Array.from(cached.values()) });
  }

  unsubscribe(topic: string, callback?: MessageCallback): void {
    const subscription = this.subscriptions.get(topic);
    if (!subscription) return;
    if (callback) subscription.callbacks.delete(callback);
    if (callback && subscription.callbacks.size > 0) return;
    this.unbind(subscription);
    this.subscriptions.delete(topic);
    if (this.lanes.has(topic)) this.closeWhenIdle(topic);
  }

  // ── Publishing ──

  /** Declare a topic to publish on; repeated calls are free and it survives reconnects. */
  advertise(topic: string, type: string): void {
    this.publishTypes.set(topic, ros2TypeName(type));
  }

  publish(topic: string, message: unknown): void {
    const client = this.control.client;
    if (!client || !this.connected) throw new Error('Not connected to foxglove_bridge');
    if (!this.hasCapability('clientPublish'))
      throw new Error('foxglove_bridge does not allow publishing (clientPublish disabled)');
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

  // ── Services, parameters and assets ──

  callService(name: string, args: unknown = {}): Promise<unknown> {
    const client = this.control.client;
    if (!client || !this.connected)
      return Promise.reject(new Error('Not connected to foxglove_bridge'));
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
    if (!client || !this.connected)
      return Promise.reject(new Error('Not connected to foxglove_bridge'));
    if (!this.hasCapability('parameters'))
      return Promise.reject(new Error('foxglove_bridge does not expose parameters'));
    const id = `parameter-${this.nextRequestId++}`;
    const promise = this.track(this.parameterRequests, id, `Parameter timeout: ${name}`);
    client.getParameters([name], id);
    return promise;
  }

  /** Fetch a `package://` or `file://` resource from the robot, as foxglove_bridge resolves it. */
  fetchAsset(uri: string): Promise<Uint8Array<ArrayBuffer>> {
    if (!this.control.client || !this.connected)
      return Promise.reject(new Error('Not connected to foxglove_bridge'));
    if (!this.hasCapability('assets'))
      return Promise.reject(new Error('foxglove_bridge does not serve assets'));
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
    for (const value of Array.from(subscription.callbacks.values())) {
      if (value === undefined) return undefined;
      rate = Math.max(rate, value);
    }
    return rate || undefined;
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
  }

  private unbind(subscription: TopicSubscription): void {
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
      if (subscription.binding?.lane === lane) subscription.binding = undefined;
    });
    if (lane !== this.control) {
      this.bindAll();
      return;
    }
    this.serverTime = null;
    // Channels, services and client advertisements belong to one connection.
    this.connected = false;
    this.services.clear();
    this.clientChannels.clear();
    this.staticTransformCache.clear();
    const fail = (pending: Pending<never>) => {
      clearTimeout(pending.timer);
      pending.reject(new Error('Disconnected from foxglove_bridge'));
    };
    this.serviceCalls.forEach(fail);
    this.parameterRequests.forEach(fail);
    this.assetRequests.forEach(fail);
    this.serviceCalls.clear();
    this.parameterRequests.clear();
    this.assetRequests.clear();
    this.assetQueue.forEach(({ reject }) => reject(new Error('Disconnected from foxglove_bridge')));
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
      lane.subscriptionTopics.delete(binding.subscriptionId);
      subscription.binding = undefined;
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
    const rate = this.maxRate(subscription);
    const now = Date.now();
    const last = subscription.lastDelivered;
    // Sooner than every subscriber's cap: skip it, including the cost of decoding.
    if (rate && last !== undefined && now - last < 1000 / rate) return;
    let message: unknown;
    try {
      message = lane.decode(binding.channelId, data);
    } catch (error) {
      console.error(`Cannot decode ${topic}:`, error);
      return;
    }
    this.retainTransforms(topic, message);
    if (rate) subscription.lastDelivered = now;
    subscription.callbacks.forEach((_rate, cb) => cb(message));
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
