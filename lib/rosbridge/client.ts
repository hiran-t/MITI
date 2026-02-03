import type {
  MessageCallback,
  ConnectionCallback,
  ErrorCallback,
  TopicInfo,
  ROSMessage,
} from './types';
import {
  createSubscribeMessage,
  createUnsubscribeMessage,
  createGetTopicsMessage,
} from './messages';

export class ROSBridge {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number = 3000;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private messageQueue: ROSMessage[] = [];
  private subscriptions: Map<string, Set<MessageCallback>> = new Map();
  private connectionCallbacks: Set<ConnectionCallback> = new Set();
  private disconnectionCallbacks: Set<ConnectionCallback> = new Set();
  private errorCallbacks: Set<ErrorCallback> = new Set();
  private connected: boolean = false;
  private shouldReconnect: boolean = true;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.connected = true;
          this.shouldReconnect = true;
          console.log('Connected to rosbridge');
          
          // Flush message queue
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg) this.send(msg);
          }

          this.connectionCallbacks.forEach(cb => cb());
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          const err = new Error('WebSocket error');
          this.errorCallbacks.forEach(cb => cb(err));
          reject(err);
        };

        this.ws.onclose = () => {
          this.connected = false;
          console.log('Disconnected from rosbridge');
          this.disconnectionCallbacks.forEach(cb => cb());

          if (this.shouldReconnect) {
            this.scheduleReconnect();
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      console.log('Attempting to reconnect...');
      this.connect().catch(err => {
        console.error('Reconnection failed:', err);
      });
    }, this.reconnectInterval);
  }

  private handleMessage(data: any): void {
    if (data.op === 'publish' && data.topic) {
      const callbacks = this.subscriptions.get(data.topic);
      if (callbacks) {
        callbacks.forEach(cb => cb(data.msg));
      }
    }
  }

  private send(message: ROSMessage): void {
    if (this.connected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.messageQueue.push(message);
    }
  }

  subscribe(
    topic: string,
    callback: MessageCallback,
    type?: string,
    options?: { throttle_rate?: number }
  ): void {
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      this.send(createSubscribeMessage(topic, type, options?.throttle_rate));
    }
    this.subscriptions.get(topic)?.add(callback);
  }

  unsubscribe(topic: string, callback?: MessageCallback): void {
    if (callback) {
      const callbacks = this.subscriptions.get(topic);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscriptions.delete(topic);
          this.send(createUnsubscribeMessage(topic));
        }
      }
    } else {
      this.subscriptions.delete(topic);
      this.send(createUnsubscribeMessage(topic));
    }
  }

  getTopics(): Promise<TopicInfo[]> {
    return new Promise((resolve, reject) => {
      const TIMEOUT_MS = 5000;
      const ws = this.ws;
      if (!ws) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      const originalOnMessage = ws.onmessage;
      let timeoutId: NodeJS.Timeout | null = null;
      let isResolved = false; // Track if promise has been resolved/rejected

      // Define cleanup function before it's used
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (ws) {
          ws.onmessage = originalOnMessage || null;
        }
      };

      // Safe resolve wrapper that checks if already resolved
      const safeResolve = (value: TopicInfo[]) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          resolve(value);
        }
      };

      // Safe reject wrapper that checks if already resolved
      const safeReject = (error: Error) => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(error);
        }
      };

      timeoutId = setTimeout(() => {
        safeReject(new Error('Timeout getting topics'));
      }, TIMEOUT_MS);

      const handleTopicsResponse = (data: any) => {
        if (data.op === 'service_response' && data.service === '/rosapi/topics') {
          const topics = this.parseTopicsResponse(data);
          safeResolve(topics);
        }
      };

      ws.onmessage = (event) => {
        // Call original handler first
        if (originalOnMessage) {
          originalOnMessage.call(ws, event);
        }

        // Only process if promise hasn't been resolved/rejected
        if (!isResolved) {
          try {
            const data = JSON.parse(event.data);
            handleTopicsResponse(data);
          } catch (error) {
            console.error('Error parsing topics response:', error);
          }
        }
      };

      this.send(createGetTopicsMessage());
    });
  }

  /**
   * Parses topics response from rosbridge service call
   */
  private parseTopicsResponse(data: any): TopicInfo[] {
    const topics: TopicInfo[] = [];
    if (data.values?.topics && data.values?.types) {
      const topicCount = Math.min(data.values.topics.length, data.values.types.length);
      for (let i = 0; i < topicCount; i++) {
        topics.push({
          topic: data.values.topics[i],
          type: data.values.types[i],
        });
      }
    }
    return topics;
  }

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

  isConnected(): boolean {
    return this.connected;
  }
}
