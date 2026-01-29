import Redis from 'ioredis';
import { config } from '../config/index.js';
import { createChildLogger } from '../utils/logger.js';

const logger = createChildLogger('redis');

export interface CacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern: string): Promise<string[]>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, field: string): Promise<void>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  publish(channel: string, message: string): Promise<void>;
  subscribe(channel: string, callback: (message: string) => void): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

class RedisCacheClient implements CacheClient {
  private client: Redis;
  private subscriber: Redis | null = null;
  private prefix: string;

  constructor() {
    this.prefix = config.REDIS_KEY_PREFIX;
    this.client = new Redis(config.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      logger.info('Redis connected');
    });

    this.client.on('error', (err) => {
      logger.error({ err }, 'Redis error');
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(this.getKey(key));
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const fullKey = this.getKey(key);
    if (ttlSeconds) {
      await this.client.setex(fullKey, ttlSeconds, value);
    } else {
      await this.client.set(fullKey, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(this.getKey(key));
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(this.getKey(key));
    return result === 1;
  }

  async keys(pattern: string): Promise<string[]> {
    const fullPattern = this.getKey(pattern);
    const keys = await this.client.keys(fullPattern);
    return keys.map((k) => k.replace(this.prefix, ''));
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(this.getKey(key), field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(this.getKey(key), field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(this.getKey(key));
  }

  async hdel(key: string, field: string): Promise<void> {
    await this.client.hdel(this.getKey(key), field);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(this.getKey(key), ttlSeconds);
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(this.getKey(channel), message);
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.subscriber) {
      this.subscriber = this.client.duplicate();
    }

    const fullChannel = this.getKey(channel);
    await this.subscriber.subscribe(fullChannel);

    this.subscriber.on('message', (ch, msg) => {
      if (ch === fullChannel) {
        callback(msg);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
      this.subscriber = null;
    }
    await this.client.quit();
    logger.info('Redis disconnected');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }
}

// Singleton instance
let cacheClient: RedisCacheClient | null = null;

export function getCache(): RedisCacheClient {
  if (!cacheClient) {
    cacheClient = new RedisCacheClient();
  }
  return cacheClient;
}

export async function closeCache(): Promise<void> {
  if (cacheClient) {
    await cacheClient.disconnect();
    cacheClient = null;
  }
}

// Cache decorator factory
export function withCache<T>(
  keyFn: (...args: unknown[]) => string,
  ttlSeconds: number = 300
) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      const cache = getCache();
      const key = keyFn(...args);

      // Try to get from cache
      const cached = await cache.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }

      // Execute original method
      const result = await originalMethod.apply(this, args);

      // Store in cache
      await cache.set(key, JSON.stringify(result), ttlSeconds);

      return result;
    };

    return descriptor;
  };
}
