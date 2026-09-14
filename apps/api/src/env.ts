import { existsSync } from 'fs';
import { join } from 'path';

// Loaded before any module reads process.env (JWT secret, CORS origins, MinIO).
const envFile = join(process.cwd(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const env = {
  port: Number(process.env.PORT ?? 4000),
  webOrigins: (process.env.WEB_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
    bucket: process.env.MINIO_BUCKET ?? 'public',
    publicUrl: process.env.MEDIA_PUBLIC_URL ?? 'http://localhost:9000/public',
  },
};
