import { readFileSync } from 'fs';
import { join } from 'path';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { env } from '../src/env';
import { createS3Client } from '../src/common/s3';

/**
 * Gives demo products and stores real photos (openly licensed, see demo-photos/CREDITS.md).
 * Only fills listings that still have no photo, so photos merchants upload are never replaced.
 * Runs on every demo deployment start and locally with `npm run db:demo-photos`.
 */
type Manifest = { products: Record<string, string>; stores: Record<string, string> };

const DIR = join(__dirname, 'demo-photos');

export async function applyDemoPhotos(prisma: PrismaClient) {
  const manifest = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8')) as Manifest;
  const s3 = createS3Client();
  const uploaded = new Map<string, string>();

  const upload = async (file: string) => {
    if (!uploaded.has(file)) {
      const key = `demo/${file}`;
      await s3.send(
        new PutObjectCommand({
          Bucket: env.minio.bucket,
          Key: key,
          Body: readFileSync(join(DIR, file)),
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      uploaded.set(file, `${env.minio.publicUrl}/${key}`);
    }
    return uploaded.get(file)!;
  };

  let products = 0;
  for (const [title, file] of Object.entries(manifest.products)) {
    const rows = await prisma.product.findMany({ where: { title, images: { isEmpty: true } }, select: { id: true } });
    if (!rows.length) continue;
    const url = await upload(file);
    await prisma.product.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { images: [url] } });
    products += rows.length;
  }

  let stores = 0;
  for (const [slug, file] of Object.entries(manifest.stores)) {
    const store = await prisma.store.findFirst({ where: { slug, coverUrl: null }, select: { id: true } });
    if (!store) continue;
    await prisma.store.update({ where: { id: store.id }, data: { coverUrl: await upload(file) } });
    stores++;
  }
  console.log(`Demo photos: ${products} products and ${stores} stores updated`);
  await applyDemoStoreDetails(prisma);
}

/** Typical souk hours (Friday afternoons only) and a map pin near the store's market, for demo stores without them. */
async function applyDemoStoreDetails(prisma: PrismaClient) {
  const day = (open: string, close: string) => ({ closed: false, open, close });
  const schedule = {
    days: [day('09:00', '21:00'), day('09:00', '21:00'), day('09:00', '21:00'), day('09:00', '21:00'), day('09:00', '21:00'), day('14:00', '21:00'), day('09:00', '21:00')],
  };
  const stores = await prisma.store.findMany({
    where: { owner: { phone: { startsWith: '9639000' } } },
    select: {
      id: true,
      slug: true,
      openingSchedule: true,
      latitude: true,
      market: { select: { latitude: true, longitude: true } },
      governorate: { select: { latitude: true, longitude: true } },
    },
  });
  let updated = 0;
  for (const s of stores) {
    const data: Record<string, unknown> = {};
    if (!s.openingSchedule) data.openingSchedule = schedule;
    const center = s.market?.latitude != null ? s.market : s.governorate;
    if (s.latitude === null && center?.latitude != null && center.longitude != null) {
      // Stable small offset per store so pins in one market don't overlap
      const h = [...s.slug].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
      data.latitude = center.latitude + (((h % 100) - 50) / 100) * 0.0016;
      data.longitude = center.longitude + ((((h >> 7) % 100) - 50) / 100) * 0.0016;
    }
    if (Object.keys(data).length) {
      await prisma.store.update({ where: { id: s.id }, data });
      updated++;
    }
  }
  console.log(`Demo store details: ${updated} stores given hours or a map pin`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  applyDemoPhotos(prisma)
    .catch((e) => {
      console.error('Demo photos failed:', e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
