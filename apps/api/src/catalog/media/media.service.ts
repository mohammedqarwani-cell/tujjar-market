import { Injectable } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { makeS3Client } from './s3.client';

@Injectable()
export class MediaService {
  private s3 = makeS3Client();
  private bucket = process.env.MINIO_BUCKET_PUBLIC || 'public';

  async getUploadUrl(contentType: string) {
    const key = `products/${randomUUID()}.${this.getExt(contentType)}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: 300 });
    const publicUrl = `http://localhost:9000/${this.bucket}/${key}`;
    return { uploadUrl, publicUrl };
  }

  private getExt(contentType: string) {
    if (contentType.includes('jpeg')) return 'jpg';
    if (contentType.includes('png')) return 'png';
    if (contentType.includes('webp')) return 'webp';
    return 'bin';
  }
}
