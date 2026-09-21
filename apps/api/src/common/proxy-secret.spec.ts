import request from 'supertest';
import { createTestApp } from '../../test/app.js';
import { clientIp } from './request.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';

const SECRET = 'test-proxy-secret-value';

/** Enough of an Express request for clientIp() */
function fakeRequest(partial: {
  proxyVerified?: boolean;
  header?: string;
  ip?: string;
}): Request {
  return {
    proxyVerified: partial.proxyVerified,
    headers: partial.header ? { 'x-tujjar-client-ip': partial.header } : {},
    ip: partial.ip ?? '10.0.0.1',
    socket: { remoteAddress: partial.ip ?? '10.0.0.1' },
  } as unknown as Request;
}

describe('only the interface proxy may reach the API', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.PROXY_SECRET = SECRET;
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.PROXY_SECRET;
  });

  it('refuses a request without the secret', async () => {
    const res = await request(app.getHttpServer())
      .get('/categories')
      .expect(403);
    expect(res.body).toMatchObject({ message: 'طلب غير مسموح' });
  });

  it('refuses a wrong secret', async () => {
    await request(app.getHttpServer())
      .get('/categories')
      .set('X-Proxy-Secret', `${SECRET}-nope`)
      .expect(403);
  });

  it('serves a request carrying the secret', async () => {
    await request(app.getHttpServer())
      .get('/categories')
      .set('X-Proxy-Secret', SECRET)
      .expect(200);
  });

  it('answers the health check without any secret', async () => {
    const res = await request(app.getHttpServer()).get('/healthz').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('client IP', () => {
  it('ignores a forged header when the proxy secret was not verified', () => {
    expect(clientIp(fakeRequest({ header: '1.2.3.4', ip: '10.0.0.1' }))).toBe(
      '10.0.0.1',
    );
  });

  it('uses the header once the request came through our proxy', () => {
    expect(
      clientIp(fakeRequest({ proxyVerified: true, header: '1.2.3.4' })),
    ).toBe('1.2.3.4');
  });

  it('ignores a verified header that is not an address', () => {
    expect(
      clientIp(
        fakeRequest({
          proxyVerified: true,
          header: 'not-an-ip',
          ip: '10.0.0.1',
        }),
      ),
    ).toBe('10.0.0.1');
  });
});
