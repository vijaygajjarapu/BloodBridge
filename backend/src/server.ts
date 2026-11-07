import http from 'http';
import { app } from './app.js';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initSocketServer } from './sockets/socket.server.js';
import { logger } from './shared/logger.js';
import { subscriptionService } from './modules/subscriptions/subscriptions.service.js';

const httpServer = http.createServer(app);

// Attach Socket.IO to HTTP server
initSocketServer(httpServer);

async function startServer() {
  try {
    // Connect to database via Prisma
    await connectDatabase();

    const PORT = config.port;
    httpServer.listen(PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`  BloodConnect Full-Stack Healthcare Platform Server   `);
      logger.info(`  Tagline: Be a Donor. Be a Savior.                   `);
      logger.info(`  REST API:      http://localhost:${PORT}/api/v1       `);
      logger.info(`  Health Check:  http://localhost:${PORT}/health       `);
      logger.info(`  Socket.IO:     ws://localhost:${PORT}                `);
      logger.info(`  Database:      Prisma ORM (Online)                  `);
      logger.info(`  Environment:   ${config.env}                         `);
      logger.info(`=======================================================`);
    });

    // Subscription renewals and "renews soon" reminders: shortly after start, then every hour
    const runRenewals = () =>
      subscriptionService.processRenewals().catch((err) => logger.error('Renewal job failed:', err?.message));
    setTimeout(runRenewals, 30_000);
    setInterval(runRenewals, 60 * 60 * 1000).unref();
  } catch (error: any) {
    logger.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Initiating graceful server shutdown...`);
  httpServer.close(async () => {
    await disconnectDatabase();
    logger.info('HTTP server and database connections closed. Process terminating cleanly.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
