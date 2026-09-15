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

/** A 32-byte AES key given as base64. */
function aesKey(name: string, devFallback: string): Buffer {
  const key = Buffer.from(secret(name, 44, Buffer.from(devFallback).toString('base64')), 'base64');
  if (key.length !== 32) throw new Error(`${name} must be 32 bytes, base64 encoded`);
  return key;
}

const list = (value: string | undefined, fallback: string) =>
  (value ?? fallback)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

const publicBucket = process.env.MINIO_BUCKET ?? 'public';
const privateBucket = process.env.MINIO_PRIVATE_BUCKET ?? 'kyc';
if (publicBucket === privateBucket) throw new Error('MINIO_PRIVATE_BUCKET must differ from the public MINIO_BUCKET');

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
  totpKey: aesKey('TOTP_ENC_KEY', 'dev-totp-key-32-bytes-long-00000'),
  /** Encrypts merchant identity documents and shop videos before they reach storage */
  kycKey: aesKey('KYC_ENC_KEY', 'dev-kyc-files-key-32-bytes-00000'),
  cookieSecure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProd,
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  /** Dev only: return OTP codes in the API response so flows can be tested without SMS */
  otpDevEcho: !isProd && process.env.OTP_DEV_ECHO === 'true',
  termsVersion: process.env.TERMS_VERSION ?? '2026-09',
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
    accessKey: process.env.MINIO_ACCESS_KEY ?? '',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
    bucket: publicBucket,
    /** Never given a public policy: verification evidence only leaves it through the admin API */
    privateBucket,
    publicUrl: process.env.MEDIA_PUBLIC_URL ?? 'http://localhost:9000/public',
  },
};
