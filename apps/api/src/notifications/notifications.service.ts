import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { NotificationCategory, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pageResult, paging } from '../common/pagination';
import type { Audience } from '../common/request';
import { ROLE_AUDIENCE } from '../auth/roles';
import {
  CATEGORY_INFO,
  MARKETING_PUSH_DAILY_CAP,
  MARKETING_PUSH_HOURS,
  PrefsMap,
  ROLE_CATEGORIES,
  damascusHour,
  describeCategory,
  effectivePrefs,
} from './categories';
import { PushService, assertPushEndpoint } from './push.service';

export type NotificationInput = {
  category: NotificationCategory;
  type: string;
  title: string;
  body: string;
  url?: string | null;
  /** Related events share a key: an unread notification from the last day is updated instead of repeated */
  groupKey?: string;
  /** Text for a grouped notification once it covers `count` events */
  grouped?: (count: number) => { title: string; body: string };
  /** With a groupKey: send only if this user never received that key (reminders, invitations) */
  once?: boolean;
  /** Decisions about the user's account: longer push lifetime and high urgency */
  urgent?: boolean;
  campaignId?: string;
};

const GROUP_WINDOW_MS = 24 * 3600_000;
/** A grouped notification pushes again only after this long, so repeated events can't buzz a phone all day */
const GROUP_REPUSH_MS = 12 * 3600_000;
const MARKETING = (Object.keys(CATEGORY_INFO) as NotificationCategory[]).filter(
  (c) => CATEGORY_INFO[c].marketing,
);
const MAX_SUBSCRIPTIONS_PER_USER = 10;
const CHUNK = 200;

const audienceOf = (role: Role): Audience =>
  (Object.keys(ROLE_AUDIENCE) as Audience[]).find((aud) =>
    ROLE_AUDIENCE[aud].includes(role),
  ) ?? 'web';

const listSelect = {
  id: true,
  category: true,
  type: true,
  title: true,
  body: true,
  url: true,
  count: true,
  readAt: true,
  createdAt: true,
} satisfies Prisma.NotificationSelect;

@Injectable()
export class NotificationsService {
  private readonly log = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private push: PushService,
  ) {}

  // ---------- sending ----------

  /** Fire and forget: a notification problem never fails the action that caused it. */
  notify(
    userIds: string | string[] | null | undefined,
    input: NotificationInput,
  ) {
    const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(
      (id): id is string => !!id,
    );
    if (!ids.length) return;
    void this.deliver(ids, input).catch((e) =>
      this.log.error(`Notification ${input.type} failed`, (e as Error).stack),
    );
  }

  /** Moderators and admins (moderation queues). */
  notifyStaff(input: NotificationInput) {
    void this.prisma.user
      .findMany({
        where: { role: { in: ['ADMIN', 'MODERATOR'] }, status: 'ACTIVE' },
        select: { id: true },
      })
      .then((users) =>
        this.notify(
          users.map((u) => u.id),
          input,
        ),
      )
      .catch((e) =>
        this.log.error(
          `Staff notification ${input.type} failed`,
          (e as Error).stack,
        ),
      );
  }

  async deliver(
    userIds: string[],
    input: NotificationInput,
  ): Promise<{ delivered: number; pushed: number }> {
    const ids = [...new Set(userIds)];
    let delivered = 0;
    let pushed = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: ids.slice(i, i + CHUNK) }, status: 'ACTIVE' },
        select: { id: true, role: true, notificationPrefs: true },
      });
      for (let j = 0; j < users.length; j += 20) {
        const results = await Promise.all(
          users.slice(j, j + 20).map((u) => this.deliverOne(u, input)),
        );
        for (const r of results) {
          if (r.shown) delivered++;
          if (r.pushed) pushed++;
        }
      }
    }
    return { delivered, pushed };
  }

  private async deliverOne(
    user: { id: string; role: Role; notificationPrefs: Prisma.JsonValue },
    input: NotificationInput,
  ): Promise<{ shown: boolean; pushed: boolean }> {
    const prefs = effectivePrefs(
      user.role,
      user.notificationPrefs,
      input.category,
    );
    if (!prefs.inApp && !prefs.push) return { shown: false, pushed: false };
    const now = new Date();

    if (input.once && input.groupKey) {
      const seen = await this.prisma.notification.findFirst({
        where: { userId: user.id, groupKey: input.groupKey },
        select: { id: true },
      });
      if (seen) return { shown: false, pushed: false };
    }

    const existing =
      input.groupKey && !input.once
        ? await this.prisma.notification.findFirst({
            where: {
              userId: user.id,
              groupKey: input.groupKey,
              readAt: null,
              createdAt: { gte: new Date(now.getTime() - GROUP_WINDOW_MS) },
            },
            select: { id: true, count: true, pushedAt: true },
          })
        : null;

    const silent = !prefs.inApp;
    let notificationId: string;
    let title = input.title;
    let body = input.body;
    if (existing) {
      const count = existing.count + 1;
      if (input.grouped) ({ title, body } = input.grouped(count));
      await this.prisma.notification.update({
        where: { id: existing.id },
        data: {
          count,
          title,
          body,
          url: input.url ?? null,
          silent,
          createdAt: now,
        },
      });
      notificationId = existing.id;
    } else {
      const created = await this.prisma.notification.create({
        data: {
          userId: user.id,
          category: input.category,
          type: input.type,
          title,
          body,
          url: input.url ?? null,
          groupKey: input.groupKey ?? null,
          silent,
          campaignId: input.campaignId ?? null,
        },
        select: { id: true },
      });
      notificationId = created.id;
    }

    if (!prefs.push) return { shown: !silent, pushed: false };
    if (
      existing?.pushedAt &&
      now.getTime() - existing.pushedAt.getTime() < GROUP_REPUSH_MS
    ) {
      return { shown: !silent, pushed: false };
    }
    if (
      CATEGORY_INFO[input.category].marketing &&
      !(await this.marketingPushAllowed(user.id, now))
    ) {
      return { shown: !silent, pushed: false };
    }

    const targets = await this.prisma.pushSubscription.findMany({
      where: { userId: user.id, audience: audienceOf(user.role) },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    if (!targets.length) return { shown: !silent, pushed: false };
    const sent = await this.push.send(
      targets,
      { title, body, url: input.url, tag: input.groupKey ?? notificationId },
      input.urgent,
    );
    if (sent)
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { pushedAt: now },
      });
    return { shown: !silent, pushed: sent > 0 };
  }

  /** Marketing pushes: daytime in Damascus only, and a few per day at most. */
  private async marketingPushAllowed(userId: string, now: Date) {
    const hour = damascusHour(now);
    if (hour < MARKETING_PUSH_HOURS.from || hour >= MARKETING_PUSH_HOURS.to)
      return false;
    const recent = await this.prisma.notification.count({
      where: {
        userId,
        category: { in: MARKETING },
        pushedAt: { gte: new Date(now.getTime() - 24 * 3600_000) },
      },
    });
    return recent < MARKETING_PUSH_DAILY_CAP;
  }

  // ---------- inbox ----------

  async list(userId: string, query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(
      query.page,
      query.pageSize,
      50,
    );
    const where: Prisma.NotificationWhereInput = { userId, silent: false };
    if (query.unread === '1') where.readAt = null;
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        select: listSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
      this.unreadQuery(userId),
    ]);
    return { ...pageResult(items, total, page, pageSize), unread };
  }

  private unreadQuery(userId: string) {
    return this.prisma.notification.count({
      where: { userId, silent: false, readAt: null },
    });
  }

  async unreadCount(userId: string) {
    return { unread: await this.unreadQuery(userId) };
  }

  /** Marks the given notifications, or all of them, as read. */
  async markRead(userId: string, ids?: string[]) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
        ...(ids?.length ? { id: { in: ids.slice(0, 100) } } : {}),
      },
      data: { readAt: new Date() },
    });
    return this.unreadCount(userId);
  }

  // ---------- preferences ----------

  async preferences(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, notificationPrefs: true },
    });
    return {
      categories: ROLE_CATEGORIES[user.role].map((key) => ({
        key,
        label: CATEGORY_INFO[key].label,
        description: describeCategory(key, user.role),
        inAppLocked: !!CATEGORY_INFO[key].inAppLocked,
        ...effectivePrefs(user.role, user.notificationPrefs, key),
      })),
    };
  }

  async updatePreferences(
    userId: string,
    changes: Record<string, { inApp?: boolean; push?: boolean }>,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true, notificationPrefs: true },
    });
    const allowed = ROLE_CATEGORIES[user.role];
    const next: PrefsMap = {
      ...((user.notificationPrefs as PrefsMap | null) ?? {}),
    };
    for (const [key, value] of Object.entries(changes)) {
      const category = key as NotificationCategory;
      if (!allowed.includes(category) || !value || typeof value !== 'object') {
        throw new BadRequestException('نوع إشعار غير معروف');
      }
      const current = effectivePrefs(user.role, next, category);
      next[category] = {
        inApp: typeof value.inApp === 'boolean' ? value.inApp : current.inApp,
        push: typeof value.push === 'boolean' ? value.push : current.push,
      };
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { notificationPrefs: next as Prisma.InputJsonValue },
    });
    return this.preferences(userId);
  }

  // ---------- push subscriptions ----------

  async subscribe(
    userId: string,
    audience: Audience,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
    userAgent: string,
  ) {
    assertPushEndpoint(sub.endpoint);
    const data = {
      userId,
      audience,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent,
      failures: 0,
    };
    // A device signing in to another account moves its subscription to that account
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { endpoint: sub.endpoint, ...data },
      update: data,
    });
    const extra = await this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: MAX_SUBSCRIPTIONS_PER_USER,
      select: { id: true },
    });
    if (extra.length)
      await this.prisma.pushSubscription.deleteMany({
        where: { id: { in: extra.map((s) => s.id) } },
      });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { subscribed: false };
  }

  async sendTest(userId: string, audience: Audience) {
    const targets = await this.prisma.pushSubscription.findMany({
      where: { userId, audience },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });
    const delivered = await this.push.send(targets, {
      title: 'تُجّار ماركت',
      body: 'الإشعارات تعمل على هذا الجهاز ✓',
      url: '/notifications',
      tag: 'push-test',
    });
    return { devices: targets.length, delivered };
  }
}
