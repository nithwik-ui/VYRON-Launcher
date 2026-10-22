import { describe, it, expect, afterAll } from 'vitest';
import { redisService } from '../src/redis/client.js';

describe('Redis Cache & Ephemeral State Abstraction', () => {
  afterAll(async () => {
    await redisService.disconnect();
  });

  it('should store and retrieve values correctly', async () => {
    const key = 'test:key:1';
    const val = 'test-value-123';

    await redisService.set(key, val);
    const retrieved = await redisService.get(key);
    expect(retrieved).toBe(val);

    await redisService.del(key);
    const afterDelete = await redisService.get(key);
    expect(afterDelete).toBeNull();
  });

  it('should expire keys with TTL', async () => {
    const key = 'test:ttl:key';
    await redisService.set(key, 'ephemeral-data', 1); // 1 second TTL

    const immediate = await redisService.get(key);
    expect(immediate).toBe('ephemeral-data');

    // Wait 1.1s for expiration
    await new Promise(resolve => setTimeout(resolve, 1100));

    const expired = await redisService.get(key);
    expect(expired).toBeNull();
  });

  it('should respond to ping without throwing', async () => {
    const isAlive = await redisService.ping();
    expect(typeof isAlive).toBe('boolean');
  });
});
