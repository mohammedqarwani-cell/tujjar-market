import { HttpException } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createTestApp } from '../../test/app.js';
import {
  createFixture,
  phoneFor,
  TEST_PASSWORD,
  type Fixture,
} from '../../test/fixtures.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

const WRONG = 'Wrong@pass123';

/** What a caller sees from one sign-in attempt: the status and the message, nothing else */
type Outcome = { status: number; message: string };

describe('sign-in failures are counted per (phone, address)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let auth: AuthService;
  let fixture: Fixture;
  /** A valid Syrian number with no account behind it */
  let unregistered: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    auth = app.get(AuthService);
    fixture = await createFixture(prisma);
    unregistered = phoneFor(fixture.tag, 9);
  });

  afterAll(async () => {
    await prisma.loginFailure.deleteMany({
      where: { phone: { in: [fixture.merchant.phone, unregistered] } },
    });
    await prisma.auditLog.deleteMany({
      where: { entityId: fixture.merchant.id },
    });
    await fixture.cleanup();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.loginFailure.deleteMany({
      where: { phone: { in: [fixture.merchant.phone, unregistered] } },
    });
  });

  async function attempt(
    phone: string,
    password: string,
    ip: string,
  ): Promise<Outcome> {
    try {
      await auth.login({ phone, password }, 'merchant', {
        ip,
        userAgent: 'jest',
      });
      return { status: 200, message: 'ok' };
    } catch (e) {
      if (!(e instanceof HttpException)) throw e;
      const body = e.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : String((body as { message: unknown }).message);
      return { status: e.getStatus(), message };
    }
  }

  it('blocks a pair after five failures while another address signs in', async () => {
    for (let i = 0; i < 5; i++) {
      expect(
        (await attempt(fixture.merchant.phone, WRONG, '198.51.100.1')).status,
      ).toBe(401);
    }
    // Even the right password is refused from the blocked address
    const blocked = await attempt(
      fixture.merchant.phone,
      TEST_PASSWORD,
      '198.51.100.1',
    );
    expect(blocked.status).toBe(429);

    const elsewhere = await attempt(
      fixture.merchant.phone,
      TEST_PASSWORD,
      '198.51.100.2',
    );
    expect(elsewhere.status).toBe(200);
  });

  it('answers an unregistered phone exactly as a registered one', async () => {
    const registered: Outcome[] = [];
    const unknown: Outcome[] = [];
    for (let i = 0; i < 7; i++) {
      registered.push(
        await attempt(fixture.merchant.phone, WRONG, '198.51.100.10'),
      );
      unknown.push(await attempt(unregistered, WRONG, '198.51.100.11'));
    }
    expect(unknown).toEqual(registered);
    // Five invalid answers, then the same block for both
    expect(registered.map((o) => o.status)).toEqual([
      401, 401, 401, 401, 401, 429, 429,
    ]);
  });

  it('clears the pair after a successful sign-in', async () => {
    const ip = '198.51.100.20';
    for (let i = 0; i < 4; i++)
      await attempt(fixture.merchant.phone, WRONG, ip);
    expect(
      (await attempt(fixture.merchant.phone, TEST_PASSWORD, ip)).status,
    ).toBe(200);

    // The count starts again: four more failures still get the ordinary answer
    for (let i = 0; i < 4; i++) {
      expect((await attempt(fixture.merchant.phone, WRONG, ip)).status).toBe(
        401,
      );
    }
    expect((await attempt(fixture.merchant.phone, WRONG, ip)).status).toBe(401);
    expect((await attempt(fixture.merchant.phone, WRONG, ip)).status).toBe(429);
  });

  it('alerts the owner at the account-wide threshold without locking them out', async () => {
    // 30 failures spread over many addresses within the hour
    await prisma.loginFailure.createMany({
      data: Array.from({ length: 30 }, (_, i) => ({
        phone: fixture.merchant.phone,
        ip: `203.0.113.${i + 1}`,
      })),
    });
    // The 31st crosses the threshold
    expect(
      (await attempt(fixture.merchant.phone, WRONG, '203.0.113.200')).status,
    ).toBe(401);

    const alert = await prisma.auditLog.findFirst({
      where: { action: 'auth.login_attack', entityId: fixture.merchant.id },
    });
    expect(alert).not.toBeNull();

    // The notification is delivered in the background
    let notice: { id: string } | null = null;
    for (let i = 0; i < 20 && !notice; i++) {
      notice = await prisma.notification.findFirst({
        where: { userId: fixture.merchant.id, type: 'security.login_attempts' },
      });
      if (!notice) await new Promise((r) => setTimeout(r, 100));
    }
    expect(notice).not.toBeNull();

    // The owner still signs in from a new address
    expect(
      (await attempt(fixture.merchant.phone, TEST_PASSWORD, '203.0.113.250'))
        .status,
    ).toBe(200);
  });
});
