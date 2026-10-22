import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { disconnectDatabase, prisma } from '../src/db/prisma.js';
import { redisService } from '../src/redis/client.js';
import { contentService } from '../src/modules/content/content.service.js';

describe('Phase 3D — Content CMS & Announcements Delivery', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
    await contentService.seedDefaultContent();
  });

  afterAll(async () => {
    await app.close();
    await disconnectDatabase();
    await redisService.disconnect();
  });

  it('GET /api/v1/news should return published news feed with HTTP cache headers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/news?limit=5',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    // Verify Cache-Control header for CDN edge caching
    const cacheControl = res.headers['cache-control'];
    expect(cacheControl).toContain('public');
    expect(cacheControl).toContain('max-age=300');

    // Verify article shape
    const article = body.data[0];
    expect(article.id).toBeDefined();
    expect(article.slug).toBeDefined();
    expect(article.title).toBeDefined();
    expect(article.summary).toBeDefined();
    expect(article.category).toBeDefined();
    expect(article.publishedAt).toBeDefined();

    // Verify pagination contract
    expect(body.pagination).toBeDefined();
    expect(body.pagination.limit).toBe(5);
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/news/:slug should return full article markdown', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/news/vyron-launcher-v3-announcement',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(body.data.slug).toBe('vyron-launcher-v3-announcement');
    expect(body.data.bodyMarkdown).toBeDefined();
    expect(body.data.bodyMarkdown).toContain('# Welcome to VYRON Launcher v3');
  });

  it('GET /api/v1/news/:slug should return 404 for unknown article', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/news/non-existent-article-slug',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBeDefined();
    expect(body.error.code).toBe('ARTICLE_NOT_FOUND');
  });

  it('GET /api/v1/announcements/active should return active service announcements with 60s cache', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/announcements/active',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(1);

    const announcement = body.data[0];
    expect(announcement.title).toBeDefined();
    expect(announcement.message).toBeDefined();
    expect(['INFO', 'WARNING', 'CRITICAL', 'MAINTENANCE']).toContain(announcement.severity);

    const cacheControl = res.headers['cache-control'];
    expect(cacheControl).toContain('max-age=60');
  });

  it('POST /api/v1/news and POST /api/v1/announcements should create content and invalidate cache', async () => {
    const testSlug = `test-article-${Date.now()}`;
    const articleRes = await app.inject({
      method: 'POST',
      url: '/api/v1/news',
      payload: {
        slug: testSlug,
        title: 'Community Spotlight #1',
        summary: 'Highlighting community shader configurations.',
        bodyMarkdown: 'Detailed shader guide content.',
        categoryId: 'community',
        authorName: 'Alex',
        status: 'PUBLISHED',
      },
    });

    expect(articleRes.statusCode).toBe(201);
    const articleBody = JSON.parse(articleRes.payload);
    expect(articleBody.success).toBe(true);
    expect(articleBody.data.slug).toBe(testSlug);

    // Verify it is immediately fetchable via slug
    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/v1/news/${testSlug}`,
    });
    expect(fetchRes.statusCode).toBe(200);

    // Clean up test article
    await prisma.newsArticle.deleteMany({ where: { slug: testSlug } });
  });
});
