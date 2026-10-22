import { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { serversService } from './servers.service.js';
import {
  listServersQuerySchema,
  createServerSchema,
  serverParamSchema,
} from './servers.schemas.js';
import { verifyAccessToken, AccessTokenPayload } from '../../common/security/jwt.js';
import { AppError } from '../../common/errors/app-error.js';

async function authenticateBearer(request: FastifyRequest) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or malformed Authorization header', 'UNAUTHORIZED');
  }

  const token = authHeader.substring(7).trim();
  const payload = verifyAccessToken(token);
  request.user = payload;
}

export const serversRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  /**
   * GET /api/v1/servers
   * Public directory of active Minecraft Java servers with player counts.
   */
  app.get('/servers', async (request, reply) => {
    const query = listServersQuerySchema.parse(request.query);
    const result = await serversService.listServers(query);

    reply.header('Cache-Control', 'public, max-age=60');
    return {
      success: true,
      data: result.servers,
      pagination: result.pagination,
    };
  });

  /**
   * GET /api/v1/servers/featured
   * Featured and sponsored placements with mandatory ethical badge disclosure.
   */
  app.get('/servers/featured', async (request, reply) => {
    const result = await serversService.getFeaturedServers();

    reply.header('Cache-Control', 'public, max-age=60');
    return {
      success: true,
      data: result,
    };
  });

  /**
   * GET /api/v1/servers/:id
   * Server details.
   */
  app.get('/servers/:id', async (request, reply) => {
    const params = serverParamSchema.parse(request.params);
    const server = await serversService.getServerDetails(params.id);

    reply.header('Cache-Control', 'public, max-age=60');
    return {
      success: true,
      data: server,
    };
  });

  /**
   * POST /api/v1/servers
   * Register a new public server.
   */
  app.post('/servers', async (request, reply) => {
    const body = createServerSchema.parse(request.body);
    const server = await serversService.createServer(body);

    reply.status(201);
    return {
      success: true,
      data: server,
    };
  });

  /**
   * POST /api/v1/servers/:id/favorite
   * Add server to authenticated player's favorites.
   */
  app.post('/servers/:id/favorite', { preHandler: [authenticateBearer] }, async (request, reply) => {
    const params = serverParamSchema.parse(request.params);
    const userId = request.user!.sub;

    const result = await serversService.toggleFavorite(userId, params.id, true);
    return result;
  });

  /**
   * DELETE /api/v1/servers/:id/favorite
   * Remove server from authenticated player's favorites.
   */
  app.delete('/servers/:id/favorite', { preHandler: [authenticateBearer] }, async (request, reply) => {
    const params = serverParamSchema.parse(request.params);
    const userId = request.user!.sub;

    const result = await serversService.toggleFavorite(userId, params.id, false);
    return result;
  });
};
