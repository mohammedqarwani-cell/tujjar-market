import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { env } from '../env';
import { createS3Client } from '../common/s3';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** A reel is a short clip, kept small so it plays on a weak connection */
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

/** The first bytes of a file say what it really is, whatever the browser claims */
const VIDEO_SIGNATURES: {
  type: string;
  ext: string;
  test: (b: Buffer) => boolean;
}[] = [
  {
    type: 'video/mp4',
    ext: 'mp4',
    test: (b) =>
      b.length > 12 && b.subarray(4, 8).toString('latin1') === 'ftyp',
  },
  {
    type: 'video/webm',
    ext: 'webm',
    test: (b) =>
      b.length > 4 &&
      b[0] === 0x1a &&
      b[1] === 0x45 &&
      b[2] === 0xdf &&
      b[3] === 0xa3,
  },
];

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
                {
                  Effect: 'Allow',
                  Principal: '*',
                  Action: ['s3:GetObject'],
                  Resource: [`arn:aws:s3:::${Bucket}/*`],
                },
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
   * A short video for a reel or a status. It is stored as it arrives (no re-encoding, the
   * server is small), so only real MP4 or WebM files within the size limit are accepted.
   */
  async uploadVideo(userId: string, file: { buffer: Buffer; size: number }) {
    if (file.size > MAX_VIDEO_BYTES)
      throw new BadRequestException(
        'حجم الفيديو أكبر من 25 ميغابايت، قصّره أو صوّره بجودة أقل',
      );
    const kind = VIDEO_SIGNATURES.find((v) => v.test(file.buffer));
    if (!kind)
      throw new BadRequestException(
        'الملف ليس فيديو صالحاً. الصيغ المسموحة: MP4 أو WEBM',
      );

    const key = `videos/${userId}/${randomUUID()}.${kind.ext}`;
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: env.minio.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: kind.type,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch {
      throw new BadRequestException('تعذّر رفع الفيديو، حاول مرة أخرى');
    }
    return { url: `${env.minio.publicUrl}/${key}` };
  }

  /**
   * The file's real content decides whether it's an image (the client's MIME type is ignored).
   * Every upload is re-encoded: this drops embedded payloads and all metadata, including the
   * GPS location phones write into photos.
   */
  async uploadImage(userId: string, file: { buffer: Buffer; size: number }) {
    if (file.size > MAX_UPLOAD_BYTES)
      throw new BadRequestException('حجم الصورة أكبر من 8 ميغابايت');

    let output: Buffer;
    try {
      const input = sharp(file.buffer, {
        limitInputPixels: MAX_INPUT_PIXELS,
        failOn: 'error',
      });
      const { format } = await input.metadata();
      if (!format || !ACCEPTED_FORMATS.has(format))
        throw new Error('unsupported');
      output = await input
        .rotate()
        .resize({
          width: MAX_SIDE,
          height: MAX_SIDE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      throw new BadRequestException(
        'الملف ليس صورة صالحة. الصيغ المسموحة: JPG أو PNG أو WEBP أو HEIC',
      );
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
