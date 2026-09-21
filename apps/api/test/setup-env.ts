/**
 * Runs before every test file, before any application module is imported.
 *
 * Tests talk to a real Postgres (the DB behaviour is what they prove) but to nothing else:
 * no SMS provider, no object storage, no push service. `process.loadEnvFile` in src/env.ts
 * does not override variables that are already set, so whatever is set here wins over .env.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** The dev database with `_test` appended, unless TEST_DATABASE_URL says otherwise. */
function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;

  const envFile = join(process.cwd(), '.env');
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('DATABASE_URL='));
    if (line) {
      const raw = line
        .slice('DATABASE_URL='.length)
        .trim()
        .replace(/^["']|["']$/g, '');
      const url = new URL(raw);
      url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;
      return url.toString();
    }
  }
  return 'postgresql://tujjar:tujjarpass@localhost:5432/tujjar_db_test?schema=public';
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= testDatabaseUrl();
process.env.DIRECT_URL ??= process.env.DATABASE_URL;

// Fixed fake secrets: tests must never depend on a developer's own .env
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-0123456789abcdefghij';
process.env.OTP_PEPPER ??= 'test-otp-pepper-0123456789abcdefghijkl';
process.env.TOTP_ENC_KEY ??= Buffer.alloc(32, 7).toString('base64');
process.env.KYC_ENC_KEY ??= Buffer.alloc(32, 11).toString('base64');
process.env.COOKIE_SECURE ??= 'false';
process.env.OTP_DEV_ECHO ??= 'true';
process.env.TRUST_PROXY ??= '0';

// Storage is replaced by a fake in the tests that need it; these only keep env.ts happy
process.env.MINIO_ENDPOINT ??= 'http://127.0.0.1:9';
process.env.MINIO_BUCKET ??= 'test-public';
process.env.MINIO_PRIVATE_BUCKET ??= 'test-kyc';
process.env.MEDIA_PUBLIC_URL ??= 'http://127.0.0.1:9/test-public';
