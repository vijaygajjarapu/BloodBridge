import { PrismaClient } from '@prisma/client';
import { logger } from '../shared/logger.js';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  errorFormat: 'pretty',
});

export async function connectDatabase(): Promise<boolean> {
  try {
    await prisma.$connect();
    logger.info('Connected to database successfully via Prisma');
    return true;
  } catch (error: any) {
    logger.error('Failed to connect to PostgreSQL database:', error.message);
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Disconnected from database');
  } catch (error: any) {
    logger.error('Error disconnecting from database:', error.message);
  }
}
