import { PrismaClient } from '@prisma/client';
import { config } from '../config/env.js';

let prismaInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient({
      datasources: {
        db: {
          url: config.DATABASE_URL,
        },
      },
      log: config.APP_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return prismaInstance;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrismaClient();
    const value = (client as any)[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  },
});

/**
 * Checks database connectivity with a harmless lightweight query.
 * Retries once if initial connection handshake is cold.
 * Throws on failure without leaking credentials.
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error: any) {
      if (attempt === 2) {
        console.error('checkDatabaseHealth failed:', error?.message || error);
        return false;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

/**
 * Gracefully disconnects Prisma on shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  if (prismaInstance) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
