import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { disconnectDatabase, prisma } from '../src/db/prisma.js';
import { redisService } from '../src/redis/client.js';
import { serversService } from '../src/modules/servers/servers.service.js';
import { signAccessToken } from '../src/common/security/jwt.js';

describe('Phase 3H — Server Ecosystem & Ethical Sponsored Promotions', () => {
  let app: FastifyInstance;
  const testUserId = '00000000-0000-0000-0000-000000000002';
  let userToken: string;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    await serversService.seedDefaultServers();

    userToken = signAccessToken({
      sub: testUserId,
      email: 'gamer@vyronlauncher.com',
      username: 'ProGamer',
      role: 'USER',
      permissions: [],
    });

    // Ensure test user exists in DB for foreign key constraint
    await prisma.user.upsert({
      where: { id: testUserId },
      update: {},
      create: {
        id: testUserId,
        username: 'ProGamer',
        email: 'gamer@vyronlauncher.com',
        passwordHash: 'dummy_hash',
        role: 'USER',
        isVerified: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.serverFavorite.deleteMany({ where: { userId: testUserId } });
    await prisma.user.deleteMany({ where: { id: testUserId } });

    await app.close();
    await disconnectDatabase();
    await redisService.disconnect();
  });

  it('GET /api/v1/servers should list active public servers with player counts and ping latency', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/servers?limit=5',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const server = body.data[0];
    expect(server.id).toBeDefined();
    expect(server.name).toBeDefined();
    expect(server.host).toBeDefined();
    expect(server.status).toBeDefined();
    expect(server.status.playersOnline).toBeGreaterThanOrEqual(0);
    expect(server.status.pingLatencyMs).toBeGreaterThanOrEqual(0);

    const cacheControl = res.headers['cache-control'];
    expect(cacheControl).toContain('max-age=60');
  });

  it('GET /api/v1/servers/featured should enforce ethical disclosure badges (SPONSORED and FEATURED)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/servers/featured',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);

    // Verify presence of SPONSORED and FEATURED badges
    const badges = body.data.map((s: any) => s.badge);
    expect(badges).toContain('FEATURED');
    expect(badges).toContain('SPONSORED');

    // Verify boolean isSponsored flag matches badge
    const sponsoredItem = body.data.find((s: any) => s.badge === 'SPONSORED');
    expect(sponsoredItem.isSponsored).toBe(true);

    const featuredItem = body.data.find((s: any) => s.badge === 'FEATURED');
    expect(featuredItem.isSponsored).toBe(false);
  });

  it('POST and DELETE /api/v1/servers/:id/favorite should bookmark and unbookmark servers', async () => {
    // 1. Fetch available server
    const listRes = await app.inject({ method: 'GET', url: '/api/v1/servers?limit=1' });
    const targetServerId = JSON.parse(listRes.payload).data[0].id;

    // 2. Favorite server
    const favRes = await app.inject({
      method: 'POST',
      url: `/api/v1/servers/${targetServerId}/favorite`,
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(favRes.statusCode).toBe(200);
    expect(JSON.parse(favRes.payload).isFavorite).toBe(true);

    // 3. Unfavorite server
    const unfavRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/servers/${targetServerId}/favorite`,
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(unfavRes.statusCode).toBe(200);
    expect(JSON.parse(unfavRes.payload).isFavorite).toBe(false);
  });
});
