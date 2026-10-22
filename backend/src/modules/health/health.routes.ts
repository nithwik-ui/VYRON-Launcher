import { FastifyInstance } from 'fastify';
import { HealthService } from './health.service.js';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    const health = HealthService.getHealth();
    return reply.status(200).send(health);
  });

  fastify.get('/ready', async (_request, reply) => {
    const readiness = await HealthService.getReadiness();
    const statusCode = readiness.status === 'ready' ? 200 : 503;
    return reply.status(statusCode).send(readiness);
  });
}
