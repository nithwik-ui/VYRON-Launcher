import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { disconnectDatabase } from '../src/db/prisma.js';
import { redisService } from '../src/redis/client.js';

describe('Fastify API Foundation & Health Probes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await disconnectDatabase();
    await redisService.disconnect();
  });

  it('GET /health should return 200 OK with process uptime', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.uptime).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/health should return 200 OK within api/v1 namespace', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
  });

  it('GET /api/v1/ready should return readiness probes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/ready',
    });

    expect([200, 503]).toContain(res.statusCode);
    const body = JSON.parse(res.payload);
    expect(['ready', 'not_ready']).toContain(body.status);
    expect(body.checks).toBeDefined();
    expect(body.checks.database).toBeDefined();
    expect(body.checks.redis).toBeDefined();
  });

  it('should include security headers (Helmet) on all HTTP responses', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('should return 404 in standardized error JSON envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/non-existent-route',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBeDefined();
    expect(body.error.message).toBeDefined();
    expect(body.error.statusCode).toBe(404);
  });
});
