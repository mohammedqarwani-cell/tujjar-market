import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../env';

export const createS3Client = () =>
  new S3Client({
    region: 'us-east-1',
    endpoint: env.minio.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: env.minio.accessKey, secretAccessKey: env.minio.secretKey },
  });
