import { PrismaClient } from '@prisma/client';

// Single shared PrismaClient instance for the whole app (important in serverless
// environments like Vercel, where creating a new client per invocation can
// exhaust the database's connection pool).
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
