import { BadRequestException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';
import { env } from '../env';
import { decrypt, encrypt } from '../common/crypto';

export type PushPayload = { title: string; body: string; url?: string | null; tag?: string | null };
type Target = { id: string; endpoint: string; p256dh: string; auth: string };

const VAPID_SETTING = 'vapid';
/** Only real browser push services: the API never posts to an address a client made up */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
];
const MAX_FAILURES = 5;
const CONCURRENCY = 20;

export function assertPushEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new BadRequestException('عنوان الإشعارات غير صالح');
  }
  if (url.protocol !== 'https:' || url.port || !PUSH_HOSTS.some((re) => re.test(url.hostname))) {
    throw new BadRequestException('خدمة الإشعارات في هذا المتصفح غير مدعومة');
  }
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly log = new Logger(PushService.name);
  private publicKey = '';
  private ready: Promise<void> | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    void this.init();
  }

  /** VAPID keys come from the environment, or are generated once and kept in the database (private key encrypted). */
  private init() {
    this.ready ??= (async () => {
      let pair: { publicKey: string; privateKey: string } | null =
        env.vapid.publicKey && env.vapid.privateKey ? { publicKey: env.vapid.publicKey, privateKey: env.vapid.privateKey } : null;
      if (!pair) {
        const read = async () => {
          const row = await this.prisma.appSetting.findUnique({ where: { key: VAPID_SETTING } });
          if (!row) return null;
          const saved = JSON.parse(row.value) as { publicKey: string; privateKey: string };
          return { publicKey: saved.publicKey, privateKey: decrypt(env.totpKey, saved.privateKey) };
        };
        pair = await read();
        if (!pair) {
          const generated = webpush.generateVAPIDKeys();
          const value = JSON.stringify({ publicKey: generated.publicKey, privateKey: encrypt(env.totpKey, generated.privateKey) });
          // Several instances may start together: the first write wins and everyone reads it back
          await this.prisma.appSetting.create({ data: { key: VAPID_SETTING, value } }).catch(() => undefined);
          pair = await read();
          this.log.log('Generated Web Push VAPID keys');
        }
      }
      if (!pair) throw new Error('VAPID keys unavailable');
      webpush.setVapidDetails(env.vapid.subject, pair.publicKey, pair.privateKey);
      this.publicKey = pair.publicKey;
    })().catch((e) => {
      this.ready = null;
      this.log.error(`Web Push setup failed: ${(e as Error).message}`);
    });
    return this.ready;
  }

  async getPublicKey() {
    await this.init();
    return this.publicKey;
  }

  /** Sends to each subscription; removes ones the push service says are gone. Returns how many were accepted. */
  async send(targets: Target[], payload: PushPayload, urgent = false): Promise<number> {
    if (!targets.length) return 0;
    await this.init();
    if (!this.publicKey) return 0;
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url ?? '/',
      tag: payload.tag ?? undefined,
    });
    let delivered = 0;
    for (let i = 0; i < targets.length; i += CONCURRENCY) {
      const batch = targets.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map((t) =>
          webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, body, {
            TTL: urgent ? 3 * 86_400 : 86_400,
            urgency: urgent ? 'high' : 'normal',
            timeout: 10_000,
          }),
        ),
      );
      await Promise.all(
        results.map(async (r, idx) => {
          const target = batch[idx];
          if (r.status === 'fulfilled') {
            delivered++;
            await this.prisma.pushSubscription
              .update({ where: { id: target.id }, data: { failures: 0, lastSuccessAt: new Date() } })
              .catch(() => undefined);
            return;
          }
          const status = (r.reason as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            await this.prisma.pushSubscription.delete({ where: { id: target.id } }).catch(() => undefined);
            return;
          }
          const sub = await this.prisma.pushSubscription
            .update({ where: { id: target.id }, data: { failures: { increment: 1 } }, select: { failures: true } })
            .catch(() => null);
          if (sub && sub.failures >= MAX_FAILURES) {
            await this.prisma.pushSubscription.delete({ where: { id: target.id } }).catch(() => undefined);
          }
          this.log.warn(`Push failed (${status ?? 'network'})`);
        }),
      );
    }
    return delivered;
  }
}
