import { PrismaClient } from '@prisma/client';

/**
 * Runs on every start of the demo deployment. The regular seed wipes all data first, so it only runs
 * here when DEMO_MODE is on and the database has no users yet; a database with real data is never touched.
 */
async function run() {
  const prisma = new PrismaClient();
  const users = await prisma.user.count();
  await prisma.$disconnect();

  if (process.env.DEMO_MODE !== 'true') return console.log('Demo seed skipped: DEMO_MODE is off');
  if (users > 0) return console.log(`Demo seed skipped: the database already has ${users} users`);

  console.log('Empty database, loading demo data...');
  // The seed script runs itself when loaded
  require('./seed');
}

run().catch((e) => {
  console.error('Demo seed check failed:', e);
  process.exit(1);
});
