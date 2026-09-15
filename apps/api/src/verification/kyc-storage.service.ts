import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from '../env';
import { createS3Client } from '../common/s3';

/**
 * Identity documents and shop videos live in a private bucket with no public policy, and the API
 * encrypts them (AES-256-GCM) before upload, so a leaked bucket or backup exposes nothing readable.
 */
@Injectable()
export class KycStorageService implements OnModuleInit {
  private readonly log = new Logger(KycStorageService.name);
  private readonly s3 = createS3Client();
  private readonly bucket = env.minio.privateBucket;

  async onModuleInit() {
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        // New buckets are private by default; no policy is ever attached to this one
        await this.s3.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.log.log(`Created private bucket "${this.bucket}"`);
      } catch (e) {
        this.log.warn(`Private storage unavailable: ${(e as Error).message}`);
      }
    }
  }

  /** Stored as iv (12) | auth tag (16) | ciphertext. */
  async put(key: string, plain: Buffer) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', env.kycKey, iv);
    const data = Buffer.concat([cipher.update(plain), cipher.final()]);
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: Buffer.concat([iv, cipher.getAuthTag(), data]),
        ContentType: 'application/octet-stream',
      }),
    );
  }

  async get(key: string): Promise<Buffer> {
    const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const buf = Buffer.from(await res.Body!.transformToByteArray());
    const decipher = createDecipheriv('aes-256-gcm', env.kycKey, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
  }

  async remove(keys: string[]) {
    for (const Key of keys) {
      await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key }));
    }
  }
}
