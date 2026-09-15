import { existsSync } from 'fs';
import { join } from 'path';

// Loaded before any module reads process.env.
const envFile = join(process.cwd(), '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const isProd = process.env.NODE_ENV === 'production';

/** Secrets must be set explicitly in production; dev gets a clearly fake fallback. */
function secret(name: string, minLength: number, devFallback: string): string {
  const value = process.env[name] ?? (isProd ? undefined : devFallback);
  if (!value || value.length < minLength) {
    throw new Error(`Environment variable ${name} is missing or shorter than ${minLength} characters`);
  }
  return value;
}

const list = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const totpKey = Buffer.from(
  secret('TOTP_ENC_KEY', 44, Buffer.from('dev-totp-key-32-bytes-long-00000').toString('base64')),
  'base64',
);
if (totpKey.length !== 32) throw new Error('TOTP_ENC_KEY must be 32 bytes, base64 encoded');

export const env = {
  isProd,
  port: Number(process.env.PORT ?? 4000),
  /** Number of reverse proxies in front of the API (for correct client IPs) */
  trustProxy: Number(process.env.TRUST_PROXY ?? (isProd ? 1 : 0)),
  origins: {
    web: list(process.env.WEB_ORIGIN, 'http://localhost:3000'),
    merchant: list(process.env.MERCHANT_ORIGIN, 'http://localhost:3000'),
    admin: list(process.env.ADMIN_ORIGIN, 'http://localhost:3000'),
  },
  jwtAccessSecret: secret('JWT_ACCESS_SECRET', 32, 'dev-access-secret-change-me-0123456789abcdef'),
  otpPepper: secret('OTP_PEPPER', 32, 'dev-otp-pepper-change-me-0123456789abcdefgh'),
  totpKey,
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  /** Dev only: return OTP codes in the API response so flows can be tested without SMS */
  otpDevEcho: !isProd && process.env.OTP_DEV_ECHO === 'true',
  termsVersion: process.env.TERMS_VERSION ?? '2026-09',
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
    bucket: process.env.MINIO_BUCKET ?? 'public',
    publicUrl: process.env.MEDIA_PUBLIC_URL ?? 'http://localhost:9000/public',
  },
};
