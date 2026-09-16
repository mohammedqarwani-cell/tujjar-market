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
