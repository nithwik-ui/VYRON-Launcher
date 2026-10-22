import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { disconnectDatabase } from '../src/db/prisma.js';
import { redisService } from '../src/redis/client.js';
import { minecraftService } from '../src/modules/minecraft/minecraft.service.js';

describe('Phase 3D — Minecraft Version Discovery & Metadata Service', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    await minecraftService.seedBaselineVersions();
  });

  afterAll(async () => {
    await app.close();
    await disconnectDatabase();
    await redisService.disconnect();
  });

  it('GET /api/v1/minecraft/versions should return indexed versions with HTTP cache header', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/minecraft/versions?limit=10',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(5);

    const cacheControl = res.headers['cache-control'];
    expect(cacheControl).toContain('max-age=3600');

    // Verify version contract
    const version = body.data[0];
    expect(version.id).toBeDefined();
    expect(version.type).toBeDefined();
    expect(version.releaseTime).toBeDefined();
    expect(version.minJavaVersion).toBeDefined();
    expect(version.recommendedRenderer).toBe('ANGLE');
    expect(version.isSupported).toBe(true);
  });

  it('GET /api/v1/minecraft/versions/1.21.4 should evaluate Java 21 prerequisite and enforce zero JAR mirroring', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/minecraft/versions/1.21.4',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('1.21.4');
    expect(body.data.minJavaVersion).toBe(21);
    expect(body.data.pistonUrl).toBeDefined();
    expect(body.data.pistonUrl).toContain('piston-meta.mojang.com');

    // Strict Architectural Invariant: Never mirror client.jar or proprietary assets
    expect(body.data.clientJar).toBeUndefined();
    expect(body.data.jarBinary).toBeUndefined();
    expect(res.payload).not.toContain('PK\x03\x04'); // ZIP/JAR magic bytes
  });

  it('GET /api/v1/minecraft/versions/1.16.5 should evaluate legacy Java 8 prerequisite', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/minecraft/versions/1.16.5',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('1.16.5');
    expect(body.data.minJavaVersion).toBe(8);
  });

  it('GET /api/v1/minecraft/compatibility should return hardware compatibility recommendations', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/minecraft/compatibility?version=1.21.4&soc=Snapdragon%208%20Gen%202&renderer=ANGLE',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('SUPPORTED');
    expect(body.data.minecraftVersion).toBe('1.21.4');
    expect(body.data.recommendedJava).toBe(21);
    expect(body.data.recommendedRenderer).toBe('ANGLE');
    expect(body.data.recommendedRamMb).toBeGreaterThanOrEqual(2048);
  });

  it('POST /api/v1/minecraft/sync should index manifest without throwing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/minecraft/sync?limit=5',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.syncedCount).toBeGreaterThan(0);
    expect(body.data.latestRelease).toBeDefined();
  });
});
