/**
 * Brings the test database up to date once per run.
 *
 * Jest loads this file outside the test module registry, so it resolves the database on its own
 * (the same rule as setup-env.ts) instead of importing it. It refuses to touch a database whose
 * name does not end in `_test`, so a stray DATABASE_URL can never migrate real data.
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const envFile = join(process.cwd(), '.env');
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8')
      .split(/\r?\n/)
      .find((l) => l.startsWith('DATABASE_URL='));
    if (line) {
      const url = new URL(
        line
          .slice('DATABASE_URL='.length)
          .trim()
          .replace(/^["']|["']$/g, ''),
      );
      url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;
      return url.toString();
    }
  }
  return 'postgresql://tujjar:tujjarpass@localhost:5432/tujjar_db_test?schema=public';
}

export default function globalSetup() {
  const url = testDatabaseUrl();
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against "${name}": the test database name must end with _test. ` +
        'Set TEST_DATABASE_URL, e.g. postgresql://tujjar:tujjarpass@localhost:5432/tujjar_db_test',
    );
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
