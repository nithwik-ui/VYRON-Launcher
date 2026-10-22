import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { contentService } from './content.service.js';
import {
  listNewsQuerySchema,
  getNewsBySlugParamSchema,
  createArticleSchema,
  createAnnouncementSchema,
} from './content.schemas.js';

export const contentRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/news
   * Public endpoint to fetch published articles with pagination and category filtering.
   */
  app.get('/news', async (request, reply) => {
    const query = listNewsQuerySchema.parse(request.query);
    const result = await contentService.listPublishedNews(query);

    reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return {
      success: true,
      data: result.articles,
      pagination: result.pagination,
    };
  });

  /**
   * GET /api/v1/news/:slug
   * Public endpoint to retrieve full markdown details for a specific article.
   */
  app.get('/news/:slug', async (request, reply) => {
    const params = getNewsBySlugParamSchema.parse(request.params);
    const article = await contentService.getNewsBySlug(params.slug);

    reply.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    return {
      success: true,
      data: article,
    };
  });

  /**
   * GET /api/v1/announcements/active
   * Public endpoint to fetch currently active service notices and urgent banners.
   */
  app.get('/announcements/active', async (request, reply) => {
    const announcements = await contentService.getActiveAnnouncements();

    reply.header('Cache-Control', 'public, max-age=60');
    return {
      success: true,
      data: announcements,
    };
  });

  /**
   * POST /api/v1/news
   * Content authoring endpoint.
   */
  app.post('/news', async (request, reply) => {
    const body = createArticleSchema.parse(request.body);
    const article = await contentService.createArticle(body);

    reply.status(201);
    return {
      success: true,
      data: article,
    };
  });

  /**
   * POST /api/v1/announcements
   * Announcement publishing endpoint.
   */
  app.post('/announcements', async (request, reply) => {
    const body = createAnnouncementSchema.parse(request.body);
    const announcement = await contentService.createAnnouncement(body);

    reply.status(201);
    return {
      success: true,
      data: announcement,
    };
  });
};
