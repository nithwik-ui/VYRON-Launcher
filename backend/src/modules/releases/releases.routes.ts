import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { releasesService } from './releases.service.js';
import {
  checkUpdateQuerySchema,
  createReleaseSchema,
  reportCrashSchema,
} from './releases.schemas.js';
import {
  authenticateAdmin,
  requirePermission,
} from '../admin/admin.middleware.js';
import { z } from 'zod';

export const releasesRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/releases/latest
   * Check for latest launcher release matching channel and client version code.
   */
  app.get('/releases/latest', async (request, reply) => {
    const query = checkUpdateQuerySchema.parse(request.query);
    const result = await releasesService.checkLatestUpdate(query);

    reply.header('Cache-Control', 'public, max-age=300');
    return {
      success: true,
      data: result,
    };
  });

  /**
   * GET /api/v1/releases
   * List all published releases and changelogs.
   */
  app.get('/releases', async (request, reply) => {
    const query = z
      .object({
        limit: z.coerce.number().int().min(1).max(50).default(20),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(request.query);

    const result = await releasesService.listReleases(query.limit, query.offset);
    reply.header('Cache-Control', 'public, max-age=600');
    return {
      success: true,
      data: result.releases,
      pagination: result.pagination,
    };
  });

  /**
   * POST /api/v1/telemetry/crash
   * Ingest privacy-scrubbed crash diagnostics (Non-PII).
   */
  app.post('/telemetry/crash', async (request, reply) => {
    const body = reportCrashSchema.parse(request.body);
    const result = await releasesService.reportCrash(body);

    reply.status(201);
    return {
      success: true,
      data: result,
    };
  });

  /**
   * POST /api/v1/admin/releases
   * Publish new launcher release (Requires releases:create).
   */
  app.post(
    '/admin/releases',
    { preHandler: [authenticateAdmin, requirePermission('releases:create')] },
    async (request, reply) => {
      const body = createReleaseSchema.parse(request.body);
      const release = await releasesService.createRelease(body);

      reply.status(201);
      return {
        success: true,
        data: release,
      };
    }
  );
};
