import { PrismaClient } from '@prisma/client';

// Single shared PrismaClient instance for the whole app. Each controller
// creating its own client was exhausting Neon's connection pool.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
