import { PrismaMariaDb } from '@prisma/adapter-mariadb';

export function createDbAdapter(): PrismaMariaDb {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL manquante : chargez .env avant de démarrer (voir docs/operations/development.md).',
    );
  }
  return new PrismaMariaDb(url);
}
