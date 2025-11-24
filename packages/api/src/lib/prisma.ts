import { PrismaClient } from '@prisma/client';

/**
 * Prisma Client singleton instance
 * Ensures only one database connection is created across the application
 * Uses global pattern to prevent multiple instances in development hot-reload
 */
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['error', 'warn'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
