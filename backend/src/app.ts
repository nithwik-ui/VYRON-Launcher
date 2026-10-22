import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import { config } from './config/env.js';
import { errorHandler } from './common/errors/error-handler.js';
import { healthRoutes } from './modules/health/health.routes.js';
import { authRoutes, userRoutes } from './modules/auth/auth.routes.js';
import { contentRoutes } from './modules/content/content.routes.js';
import { minecraftRoutes } from './modules/minecraft/minecraft.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { releasesRoutes } from './modules/releases/releases.routes.js';
import { serversRoutes } from './modules/servers/servers.routes.js';

export function buildApp(): FastifyInstance {
  const app = fastify({
    logger: config.APP_ENV === 'test' ? false : {
      level: config.LOG_LEVEL,
      redact: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.passwordHash',
        '*.token',
        '*.accessToken',
        '*.refreshToken',
        '*.secret',
      ],
    },
  });

  // Global Error Handler
  app.setErrorHandler(errorHandler);

  // Standardized 404 Not Found Handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: {
        code: 'NOT_FOUND',
        message: `Route ${request.method}:${request.url} not found`,
        statusCode: 404,
        requestId: request.id || 'unknown',
      },
    });
  });

  // Security Headers (Helmet)
  app.register(helmet, {
    contentSecurityPolicy: config.APP_ENV === 'production',
  });

  // CORS Configuration
  const allowedOrigins = config.CORS_ORIGIN.split(',').map(o => o.trim());
  app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin) || config.APP_ENV === 'development') {
        return cb(null, true);
      }
      return cb(new Error('CORS origin denied'), false);
    },
    credentials: true,
  });

  // Global Rate Limiting
  app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
  });

  // Sensible Utilities (HttpErrors)
  app.register(sensible);

  // Root operational probes (for load balancers & cloud orchestrators)
  app.register(healthRoutes);

  // API v1 namespace
  app.register(healthRoutes, { prefix: '/api/v1' });
  app.register(authRoutes, { prefix: '/api/v1/auth' });
  app.register(userRoutes, { prefix: '/api/v1' });
  app.register(contentRoutes, { prefix: '/api/v1' });
  app.register(minecraftRoutes, { prefix: '/api/v1' });
  app.register(adminRoutes, { prefix: '/api/v1' });
  app.register(releasesRoutes, { prefix: '/api/v1' });
  app.register(serversRoutes, { prefix: '/api/v1' });

  return app;
}
