import { createServer, startServer } from './api/server.js';
import { getDatabase, closeDatabase } from './database/client.js';
import { getCache, closeCache } from './cache/client.js';
import { logger } from './utils/logger.js';
import { getWebSocketSyncService } from './services/websocket-sync.service.js';

async function main(): Promise<void> {
  logger.info('Starting EGCE Memory Service...');

  // Initialize database connection
  const db = getDatabase();
  logger.info('Database connection pool initialized');

  // Initialize Redis connection
  const cache = getCache();
  await cache.connect();
  logger.info('Redis connection established');

  // Create and start HTTP server
  const server = await createServer();
  await startServer(server);

  // Graceful shutdown handlers
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Received shutdown signal');

    try {
      // Shutdown WebSocket service first
      const wsService = getWebSocketSyncService();
      await wsService.shutdown();
      logger.info('WebSocket sync service closed');

      // Close HTTP server
      await server.close();
      logger.info('HTTP server closed');

      // Close database connections
      await closeDatabase();
      logger.info('Database connections closed');

      // Close Redis connection
      await closeCache();
      logger.info('Redis connection closed');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
}

main().catch((error) => {
  logger.fatal({ error }, 'Failed to start application');
  process.exit(1);
});
