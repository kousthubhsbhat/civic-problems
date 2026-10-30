import { PrismaClient } from '@prisma/client';
import { ENV } from './env';

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma = global.prismaGlobal || new PrismaClient({
  log: ENV.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
});

if (ENV.NODE_ENV !== 'production') {
  global.prismaGlobal = prisma;
}

export const connectDatabase = async (): Promise<boolean> => {
  try {
    await prisma.$connect();
    console.log('✅ [Database] PostgreSQL connected successfully via Prisma ORM.');
    return true;
  } catch (err: any) {
    console.warn(`⚠️ [Database] PostgreSQL connection warning: ${err.message}.`);
    console.warn('ℹ️ Ensure DATABASE_URL is configured in backend/.env for persistent queries.');
    return false;
  }
};
