import Redis from 'ioredis';
import { config } from '../config/env.js';

export interface IRedisService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  ping(): Promise<boolean>;
  disconnect(): Promise<void>;
  isUsingFallback(): boolean;
}

class InMemoryRedisStore implements IRedisService {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async disconnect(): Promise<void> {
    this.store.clear();
  }

  isUsingFallback(): boolean {
    return true;
  }
}

class RealRedisService implements IRedisService {
  private client: Redis;
  private isConnected = false;
  private fallbackStore = new InMemoryRedisStore();

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: (times) => {
        if (times > 3) return null; // Stop retrying and use in-memory fallback
        return Math.min(times * 100, 1000);
      },
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
    });

    this.client.on('error', () => {
      this.isConnected = false;
    });
  }

  async init(): Promise<void> {
    try {
      await this.client.connect();
      this.isConnected = true;
    } catch {
      this.isConnected = false;
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      if (config.APP_ENV === 'production') {
        throw new Error('REDIS_UNAVAILABLE: Real Redis connection is strictly required in production mode. In-memory fallback is disabled.');
      }
      return this.fallbackStore.get(key);
    }
    try {
      return await this.client.get(key);
    } catch (err) {
      if (config.APP_ENV === 'production') {
        throw err;
      }
      return this.fallbackStore.get(key);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.isConnected) {
      if (config.APP_ENV === 'production') {
        throw new Error('REDIS_UNAVAILABLE: Real Redis connection is strictly required in production mode. In-memory fallback is disabled.');
      }
      await this.fallbackStore.set(key, value, ttlSeconds);
      return;
    }
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
    } catch (err) {
      if (config.APP_ENV === 'production') {
        throw err;
      }
      await this.fallbackStore.set(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) {
      if (config.APP_ENV === 'production') {
        throw new Error('REDIS_UNAVAILABLE: Real Redis connection is strictly required in production mode. In-memory fallback is disabled.');
      }
      await this.fallbackStore.del(key);
      return;
    }
    try {
      await this.client.del(key);
    } catch (err) {
      if (config.APP_ENV === 'production') {
        throw err;
      }
      await this.fallbackStore.del(key);
    }
  }

  async ping(): Promise<boolean> {
    if (!this.isConnected) return false;
    try {
      const res = await this.client.ping();
      return res === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.quit();
      } catch {
        this.client.disconnect();
      }
    }
    await this.fallbackStore.disconnect();
  }

  isUsingFallback(): boolean {
    return !this.isConnected;
  }
}

export const redisService: IRedisService = new RealRedisService(config.REDIS_URL);
if (redisService instanceof RealRedisService) {
  redisService.init().catch(() => {
    // Graceful fallback to in-memory store
  });
}
