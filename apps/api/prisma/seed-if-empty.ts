import { PrismaClient } from '@prisma/client';
import { applyDemoPhotos } from './demo-photos';

/**
 * Runs on every start of the demo deployment. The regular seed wipes all data first, so it only runs
 * here when DEMO_MODE is on and the database has no users yet; a database with real data is never touched.
 */
async function run() {
  const prisma = new PrismaClient();
  const users = await prisma.user.count();

  if (process.env.DEMO_MODE !== 'true') {
    await prisma.$disconnect();
    return console.log('Demo seed skipped: DEMO_MODE is off');
  }
  if (users > 0) {
    // Existing demo data still gets photos for listings that have none
    await applyDemoPhotos(prisma).catch((e) => console.error('Demo photos failed:', (e as Error).message));
    await prisma.$disconnect();
    return console.log(`Demo seed skipped: the database already has ${users} users`);
  }
  await prisma.$disconnect();

  console.log('Empty database, loading demo data...');
  // The seed script runs itself when loaded
  require('./seed');
}

run().catch((e) => {
  console.error('Demo seed check failed:', e);
  process.exit(1);
});
