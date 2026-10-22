import { checkDatabaseHealth } from '../../db/prisma.js';
import { redisService } from '../../redis/client.js';
import { config } from '../../config/env.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
}

export interface ReadinessStatus {
  status: 'ready' | 'not_ready';
  timestamp: string;
  checks: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy' | 'degraded' | 'in_memory_fallback';
  };
}

export class HealthService {
  static getHealth(): HealthStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  static async getReadiness(): Promise<ReadinessStatus> {
    const isDbHealthy = await checkDatabaseHealth();
    const isRedisHealthy = await redisService.ping();

    const isProduction = config.APP_ENV === 'production';
    const isRedisUsingFallback = redisService.isUsingFallback();

    const checks = {
      database: isDbHealthy ? ('healthy' as const) : ('unhealthy' as const),
      redis: isRedisHealthy 
        ? ('healthy' as const) 
        : (isProduction ? ('unhealthy' as const) : (isRedisUsingFallback ? ('in_memory_fallback' as const) : ('degraded' as const))),
    };

    // In production, both PostgreSQL AND Redis are mandatory for readiness
    const isReady = isProduction ? (isDbHealthy && isRedisHealthy) : isDbHealthy;

    return {
      status: isReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    };
  }
}
