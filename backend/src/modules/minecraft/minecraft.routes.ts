import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { minecraftService } from './minecraft.service.js';
import {
  listMinecraftVersionsQuerySchema,
  getMinecraftVersionParamSchema,
  queryCompatibilitySchema,
  syncVersionsQuerySchema,
} from './minecraft.schemas.js';

export const minecraftRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/minecraft/versions
   * List indexed Minecraft Java versions with Java prerequisites and release timestamps.
   */
  app.get('/minecraft/versions', async (request, reply) => {
    const query = listMinecraftVersionsQuerySchema.parse(request.query);
    const result = await minecraftService.listVersions(query);

    reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
    return {
      success: true,
      data: result.versions,
      pagination: result.pagination,
    };
  });

  /**
   * GET /api/v1/minecraft/versions/:id
   * Get version technical prerequisites, asset index, and upstream manifest pointer.
   * INVARIANT: Zero client JAR mirroring.
   */
  app.get('/minecraft/versions/:id', async (request, reply) => {
    const params = getMinecraftVersionParamSchema.parse(request.params);
    const version = await minecraftService.getVersionDetails(params.id);

    reply.header('Cache-Control', 'public, max-age=3600, stale-while-revalidate=7200');
    return {
      success: true,
      data: version,
    };
  });

  /**
   * GET /api/v1/minecraft/compatibility
   * Query mobile GPU renderer and Java runtime compatibility for a given SoC and version.
   */
  app.get('/minecraft/compatibility', async (request, reply) => {
    const query = queryCompatibilitySchema.parse(request.query);
    const result = await minecraftService.queryCompatibility(query);

    reply.header('Cache-Control', 'public, max-age=86400');
    return {
      success: true,
      data: result,
    };
  });

  /**
   * POST /api/v1/minecraft/sync
   * Ingest and index versions from official Mojang Piston Manifest v2.
   */
  app.post('/minecraft/sync', async (request, reply) => {
    const query = syncVersionsQuerySchema.parse(request.query);
    const result = await minecraftService.syncWithMojangManifest(query);

    return {
      success: true,
      data: result,
    };
  });
};
