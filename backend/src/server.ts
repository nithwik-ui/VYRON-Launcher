import { buildApp } from './app.js';
import { config, getSanitizedConfig } from './config/env.js';
import { disconnectDatabase } from './db/prisma.js';
import { redisService } from './redis/client.js';

async function startServer() {
  const app = buildApp();

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      await disconnectDatabase();
      await redisService.disconnect();
      app.log.info('Server and background connections closed cleanly');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    app.log.info(getSanitizedConfig(), 'Starting VYRON Backend with sanitized configuration:');
    const address = await app.listen({ port: config.PORT, host: config.HOST });
    app.log.info(`VYRON Backend server listening at ${address}`);
  } catch (err) {
    app.log.error(err, 'Failed to start VYRON Backend server');
    process.exit(1);
  }
}

startServer();
