import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { env } from '../env';
import { createS3Client } from '../common/s3';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_SIDE = 1600;
const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif']);

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly log = new Logger(MediaService.name);
  private readonly s3 = createS3Client();

  async onModuleInit() {
    const Bucket = env.minio.bucket;
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket }));
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket }));
        await this.s3.send(
          new PutBucketPolicyCommand({
            Bucket,
            Policy: JSON.stringify({
              Version: '2012-10-17',
              Statement: [
                { Effect: 'Allow', Principal: '*', Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${Bucket}/*`] },
              ],
            }),
          }),
        );
        this.log.log(`Created public bucket "${Bucket}"`);
      } catch (e) {
        this.log.warn(`Media storage unavailable: ${(e as Error).message}`);
      }
    }
  }

  /**
   * The file's real content decides whether it's an image (the client's MIME type is ignored).
   * Every upload is re-encoded: this drops embedded payloads and all metadata, including the
   * GPS location phones write into photos.
   */
  async uploadImage(userId: string, file: { buffer: Buffer; size: number }) {
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('حجم الصورة أكبر من 8 ميغابايت');

    let output: Buffer;
    try {
      const input = sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
      const { format } = await input.metadata();
      if (!format || !ACCEPTED_FORMATS.has(format)) throw new Error('unsupported');
      output = await input
        .rotate()
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException('الملف ليس صورة صالحة. الصيغ المسموحة: JPG أو PNG أو WEBP أو HEIC');
    }

    const key = `uploads/${userId}/${randomUUID()}.webp`;
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: env.minio.bucket,
          Key: key,
          Body: output,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch {
      throw new BadRequestException('تعذّر رفع الصورة، حاول مرة أخرى');
    }
    return { url: `${env.minio.publicUrl}/${key}` };
  }
}
