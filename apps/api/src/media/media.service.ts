import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { env } from '../env';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

@Injectable()
export class MediaService implements OnModuleInit {
  private readonly log = new Logger(MediaService.name);
  private readonly s3 = new S3Client({
    region: 'us-east-1',
    endpoint: env.minio.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: env.minio.accessKey, secretAccessKey: env.minio.secretKey },
  });

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
        // The API still works without uploads (e.g. MinIO not running)
        this.log.warn(`Media storage unavailable: ${(e as Error).message}`);
      }
    }
  }

  async uploadImage(userId: string, file: { buffer: Buffer; mimetype: string; size: number }) {
    const ext = EXT[file.mimetype];
    if (!ext) throw new BadRequestException('الصيغ المسموحة: JPG أو PNG أو WEBP');
    if (file.size > MAX_UPLOAD_BYTES) throw new BadRequestException('حجم الصورة أكبر من 5 ميغابايت');

    const key = `uploads/${userId}/${randomUUID()}.${ext}`;
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: env.minio.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch {
      throw new BadRequestException('تعذّر رفع الصورة، حاول مرة أخرى');
    }
    return { url: `${env.minio.publicUrl}/${key}` };
  }
}
