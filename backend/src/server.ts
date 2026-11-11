import http from 'http';
import { app } from './app.js';
import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { initSocketServer } from './sockets/socket.server.js';
import { logger } from './shared/logger.js';
import { subscriptionService } from './modules/subscriptions/subscriptions.service.js';
import { requestService } from './modules/requests/requests.service.js';
import { communityService } from './modules/communities/communities.service.js';
import { runDonorReminders } from './modules/eligibility/eligibility.jobs.js';

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
      logger.info(`  Manvi Blood Platform Server   `);
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

    // Communities: "Still at X?" every 6 months, stale after 30 days without an answer (hourly)
    const runReconfirm = () =>
      communityService.processReconfirmations().catch((err) => logger.error('Community re-confirm job failed:', err?.message));
    setTimeout(runReconfirm, 45_000);
    setInterval(runReconfirm, 60 * 60 * 1000).unref();

    // Donors: end finished pauses, and "You can donate again" after the gap (hourly)
    const runReminders = () => runDonorReminders().catch((err) => logger.error('Donor reminders job failed:', err?.message));
    setTimeout(runReminders, 60_000);
    setInterval(runReminders, 60 * 60 * 1000).unref();

    // Smart matching waves: contact the next group of donors for requests that still need them (every minute)
    const runWaves = () =>
      requestService.runDueWaves().catch((err) => logger.error('Wave job failed:', err?.message));
    setInterval(runWaves, 60 * 1000).unref();
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
