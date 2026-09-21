import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from '../../test/app.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from './orders.js';
import {
  createFixture,
  TEST_PASSWORD,
  type Fixture,
} from '../../test/fixtures.js';

/** The cap a merchant may put on one product (products/product.dto.ts) */
const MAX_PRICE = 2_000_000_000;
const MAX_QUANTITY = 9999;

describe('order totals beyond Int32', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let orders: OrdersService;
  let fixture: Fixture;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    orders = app.get(OrdersService);
    fixture = await createFixture(prisma, {
      products: [
        { price: 1_500_000_000 },
        { price: 1_500_000_000 },
        { price: MAX_PRICE },
      ],
    });
  });

  afterAll(async () => {
    await fixture.cleanup();
    await app.close();
  });

  const buyer = () => ({
    id: fixture.buyer.id,
    role: 'BUYER' as const,
    aud: 'web' as const,
    sid: 'test',
    mfa: false,
  });

  const pickup = (items: { productId: string; quantity: number }[]) => ({
    items,
    fulfillment: 'PICKUP' as const,
    payment: 'CASH_AT_SHOP' as const,
  });

  it('adds two lines of 1,500,000,000 into a total Int32 could not hold', async () => {
    const [a, b] = fixture.products;
    const created = await orders.create(
      buyer(),
      pickup([
        { productId: a.id, quantity: 1 },
        { productId: b.id, quantity: 1 },
      ]),
    );

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: created.id },
      select: { total: true, items: { select: { lineTotal: true } } },
    });
    expect(stored.total).toBe(3_000_000_000n);
    expect(stored.total).toBeGreaterThan(2_147_483_647n);
    expect(stored.items.map((i) => i.lineTotal).sort()).toEqual([
      1_500_000_000n,
      1_500_000_000n,
    ]);
  });

  it('accepts one line at the highest price and quantity a merchant can set', async () => {
    const expensive = fixture.products[2];
    const created = await orders.create(
      buyer(),
      pickup([{ productId: expensive.id, quantity: MAX_QUANTITY }]),
    );

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: created.id },
      select: { total: true },
    });
    expect(stored.total).toBe(BigInt(MAX_PRICE) * BigInt(MAX_QUANTITY));
    expect(stored.total).toBe(19_998_000_000_000n);
  });

  it('returns plain numbers to the buyer, not BigInt', async () => {
    const mine = await orders.mine(fixture.buyer.id, {});
    const order = mine.items[0];
    expect(typeof order.total).toBe('number');
    expect(typeof order.items[0].lineTotal).toBe('number');
    // Serialising a BigInt throws, so this also proves the response can be sent
    expect(() => JSON.stringify(mine)).not.toThrow();
  });

  it('serialises large totals over HTTP', async () => {
    const server = app.getHttpServer();
    const login = await request(server)
      .post('/auth/login')
      .set('X-Client', 'web')
      .send({ phone: fixture.buyer.phone, password: TEST_PASSWORD })
      .expect(200);

    const res = await request(server)
      .get('/orders/mine')
      .set('X-Client', 'web')
      .set('Cookie', login.headers['set-cookie'])
      .expect(200);

    const body = res.body as {
      items: { total: number; items: { lineTotal: number }[] }[];
    };
    expect(body.items.length).toBeGreaterThan(0);
    for (const order of body.items) {
      expect(typeof order.total).toBe('number');
      for (const line of order.items)
        expect(typeof line.lineTotal).toBe('number');
    }
    expect(body.items.some((o) => o.total > 2_147_483_647)).toBe(true);
  });
});
