import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import {
  GeoCheck,
  Prisma,
  VerificationKind,
  VerificationStatus,
} from '@prisma/client';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.module';
import { distanceMeters, insideSyria } from '../common/geo';
import { pageResult, paging } from '../common/pagination';
import { KycStorageService } from './kyc-storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { damascusDay } from '../common/pagination';
import {
  DecisionDto,
  LocationEvidenceDto,
  StoreLevelDto,
} from './verification.dto';
import {
  BADGE_REPORT_THRESHOLD,
  BADGE_REPORT_WINDOW_DAYS,
  DAY_MS,
  PRODUCT_LIMITS,
  REJECTED_FILES_RETENTION_DAYS,
  RENEWAL_WINDOW_DAYS,
  VERIFICATION_VALID_DAYS,
  atLeast,
  levelRank,
  maxLevel,
} from './verification.levels';

export type UploadedFile = { buffer: Buffer; size: number };
export const FILE_SLOTS = [
  'idFront',
  'idBack',
  'selfie',
  'video',
  'document',
] as const;
export type FileSlot = (typeof FILE_SLOTS)[number];
type StoredFile = { key: string; type: string; size: number };
type FileMap = Partial<Record<FileSlot, StoredFile>>;
type PreparedFile = { buffer: Buffer; type: string };

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 40 * 1024 * 1024;
const IMAGE_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif', 'avif']);
/** GPS readings less precise than this can't place a shop inside a market */
const MAX_GPS_ACCURACY_M = 150;
/** The video must be sent soon after recording, so an old clip can't be reused */
const MAX_CAPTURE_AGE_MS = 20 * 60_000;
const CLOCK_SKEW_MS = 2 * 60_000;
const MAINTENANCE_EVERY_MS = 6 * 3600_000;
const PENDING_MESSAGE = 'لديك طلب توثيق قيد المراجعة، سنراجعه قريباً';

const storeForVerification = {
  id: true,
  name: true,
  verificationLevel: true,
  earnedLevel: true,
  verificationExpiresAt: true,
  badgeSuspendedAt: true,
  market: {
    select: {
      name: true,
      latitude: true,
      longitude: true,
      radiusMeters: true,
      geofenceStatus: true,
    },
  },
  _count: { select: { products: true } },
} satisfies Prisma.StoreSelect;
type VerificationStore = Prisma.StoreGetPayload<{
  select: typeof storeForVerification;
}>;

const adminStoreLevelSelect = {
  id: true,
  verificationLevel: true,
  earnedLevel: true,
  badgeSuspendedAt: true,
  verificationExpiresAt: true,
  status: true,
} satisfies Prisma.StoreSelect;

function geofenceOf(market: VerificationStore['market']) {
  if (
    !market ||
    market.latitude === null ||
    market.longitude === null ||
    market.radiusMeters === null
  )
    return null;
  return {
    lat: market.latitude,
    lng: market.longitude,
    radius: market.radiusMeters,
    name: market.name,
    confirmed: market.geofenceStatus === 'CONFIRMED',
  };
}

@Injectable()
export class VerificationService
  implements OnModuleInit, OnApplicationShutdown
{
  private readonly log = new Logger(VerificationService.name);
  private readonly timers: NodeJS.Timeout[] = [];

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private storage: KycStorageService,
    private notifications: NotificationsService,
  ) {}

  /** Tells the store owner about a decision on their store. */
  private notifyOwner(
    storeId: string,
    input: { type: string; title: string; body: string; url?: string },
  ) {
    void this.prisma.store
      .findUnique({ where: { id: storeId }, select: { ownerId: true } })
      .then((s) =>
        this.notifications.notify(s?.ownerId, {
          category: 'ACCOUNT',
          url: '/dashboard/verification',
          urgent: true,
          ...input,
        }),
      );
  }

  onModuleInit() {
    const run = () => void this.runMaintenance();
    this.timers.push(
      setTimeout(run, 15_000),
      setInterval(run, MAINTENANCE_EVERY_MS),
    );
    this.timers.forEach((t) => t.unref());
  }

  onApplicationShutdown() {
    this.timers.forEach((t) => clearTimeout(t));
  }

  // ---------- merchant ----------

  private async storeOf(userId: string) {
    const store = await this.prisma.store.findFirst({
      where: { ownerId: userId },
      select: storeForVerification,
    });
    if (!store) throw new NotFoundException('لا يوجد متجر مرتبط بحسابك');
    return store;
  }

  /** Why the store can't submit this kind of evidence now, or null when it can. */
  private blockedReason(
    store: VerificationStore,
    kind: VerificationKind,
  ): string | null {
    if (store.badgeSuspendedAt)
      return 'شارة التوثيق موقوفة مؤقتاً بسبب بلاغات مؤكدة. تواصل مع إدارة المنصة';
    if (kind === 'IDENTITY')
      return store.earnedLevel === 'REGISTERED' ? null : 'هويتك موثّقة مسبقاً';
    if (store.earnedLevel === 'REGISTERED')
      return 'وثّق هويتك أولاً، ثم وثّق المحل';
    if (store.earnedLevel === 'IDENTITY' || !store.verificationExpiresAt)
      return null;
    const renewFrom =
      store.verificationExpiresAt.getTime() - RENEWAL_WINDOW_DAYS * DAY_MS;
    return Date.now() >= renewFrom
      ? null
      : `توثيق المحل ساري، ويمكن تجديده قبل انتهائه بـ${RENEWAL_WINDOW_DAYS} يوماً`;
  }

  async status(userId: string) {
    const store = await this.storeOf(userId);
    const requests = await this.prisma.verificationRequest.findMany({
      where: { storeId: store.id },
      select: {
        id: true,
        kind: true,
        status: true,
        rejectReason: true,
        geoCheck: true,
        createdAt: true,
        reviewedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    const step = (kind: VerificationKind) => {
      const pending = requests.some(
        (r) => r.kind === kind && r.status === 'PENDING',
      );
      const reason = pending ? 'قيد المراجعة' : this.blockedReason(store, kind);
      return { canSubmit: reason === null, pending, reason };
    };
    return {
      level: store.verificationLevel,
      earnedLevel: store.earnedLevel,
      badgeSuspended: !!store.badgeSuspendedAt,
      expiresAt: store.verificationExpiresAt,
      productLimit: PRODUCT_LIMITS[store.verificationLevel],
      productCount: store._count.products,
      market: store.market
        ? {
            name: store.market.name,
            hasGeofence: !!geofenceOf(store.market)?.confirmed,
          }
        : null,
      identity: step('IDENTITY'),
      location: step('LOCATION'),
      requests,
    };
  }

  async submitIdentity(
    userId: string,
    files: Partial<Record<FileSlot, UploadedFile>>,
    ip: string,
  ) {
    const store = await this.storeOf(userId);
    await this.assertCanSubmit(store, 'IDENTITY');
    const { idFront, idBack, selfie } = files;
    if (!idFront || !idBack || !selfie) {
      throw new BadRequestException(
        'أرفق صورة وجه الهوية وظهرها، وصورة شخصية وأنت تحمل الهوية',
      );
    }
    const prepared = {
      idFront: await this.documentImage(idFront),
      idBack: await this.documentImage(idBack),
      selfie: await this.documentImage(selfie),
    };
    return this.createRequest(store.id, 'IDENTITY', prepared, {}, userId, ip);
  }

  async submitLocation(
    userId: string,
    files: Partial<Record<FileSlot, UploadedFile>>,
    evidence: LocationEvidenceDto,
    ip: string,
  ) {
    const store = await this.storeOf(userId);
    await this.assertCanSubmit(store, 'LOCATION');
    if (!files.video)
      throw new BadRequestException('صوّر فيديو المحل من داخل التطبيق');

    const captured = new Date(evidence.capturedAt).getTime();
    const age = Date.now() - captured;
    if (
      !Number.isFinite(captured) ||
      age > MAX_CAPTURE_AGE_MS ||
      age < -CLOCK_SKEW_MS
    ) {
      throw new BadRequestException(
        'صوّر الفيديو الآن من داخل التطبيق، ثم أرسله مباشرة',
      );
    }
    if (evidence.accuracy > MAX_GPS_ACCURACY_M) {
      throw new BadRequestException(
        'دقة تحديد الموقع ضعيفة. فعّل الموقع الدقيق في الموبايل واقترب من باب المحل، ثم أعد التصوير',
      );
    }
    if (!insideSyria(evidence.latitude, evidence.longitude)) {
      throw new BadRequestException(
        'موقع التصوير خارج سوريا. صوّر الفيديو من داخل محلك',
      );
    }

    let geoCheck: GeoCheck = 'NO_GEOFENCE';
    let distance: number | null = null;
    const fence = geofenceOf(store.market);
    if (fence) {
      distance = Math.round(
        distanceMeters(
          evidence.latitude,
          evidence.longitude,
          fence.lat,
          fence.lng,
        ),
      );
      // GPS error is tolerated up to 100 m on top of the market radius
      const allowed = fence.radius + Math.min(evidence.accuracy, 100);
      const inside = distance <= allowed;
      // Only a surveyed (confirmed) boundary refuses a merchant; a draft one is a hint for the reviewer
      if (!inside && fence.confirmed) {
        await this.audit.log({
          actorId: userId,
          action: 'verification.geo_rejected',
          entityType: 'store',
          entityId: store.id,
          meta: { distance, allowed, market: fence.name },
          ip,
        });
        throw new BadRequestException(
          `موقع التصوير يبعد ${distance} متر عن ${fence.name}. صوّر الفيديو من داخل محلك، أو صحّح السوق من إعدادات المتجر`,
        );
      }
      geoCheck = inside ? 'INSIDE' : 'OUTSIDE';
    }

    const prepared: Partial<Record<FileSlot, PreparedFile>> = {
      video: this.videoFile(files.video),
    };
    if (files.document)
      prepared.document = await this.documentImage(files.document);
    return this.createRequest(
      store.id,
      'LOCATION',
      prepared,
      {
        latitude: evidence.latitude,
        longitude: evidence.longitude,
        accuracyMeters: evidence.accuracy,
        capturedAt: new Date(captured),
        geoCheck,
        distanceMeters: distance,
      },
      userId,
      ip,
    );
  }

  private async assertCanSubmit(
    store: VerificationStore,
    kind: VerificationKind,
  ) {
    const reason = this.blockedReason(store, kind);
    if (reason) throw new BadRequestException(reason);
    const pending = await this.prisma.verificationRequest.findFirst({
      where: { storeId: store.id, kind, status: 'PENDING' },
      select: { id: true },
    });
    if (pending) throw new ConflictException(PENDING_MESSAGE);
  }

  /** Re-encodes identity photos: refuses non-images and strips metadata, keeping the ID readable. */
  private async documentImage(file: UploadedFile): Promise<PreparedFile> {
    if (file.size > IMAGE_MAX_BYTES)
      throw new BadRequestException('حجم الصورة أكبر من 8 ميغابايت');
    try {
      const input = sharp(file.buffer, {
        limitInputPixels: 40_000_000,
        failOn: 'error',
      });
      const { format } = await input.metadata();
      if (!format || !IMAGE_FORMATS.has(format)) throw new Error('unsupported');
      const buffer = await input
        .rotate()
        .resize({
          width: 2000,
          height: 2000,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer();
      return { buffer, type: 'image/jpeg' };
    } catch {
      throw new BadRequestException(
        'أحد الملفات ليس صورة صالحة. الصيغ المسموحة: JPG أو PNG أو WEBP أو HEIC',
      );
    }
  }

  /** Only real MP4/MOV or WebM containers are accepted, judged by their first bytes. */
  private videoFile(file: UploadedFile): PreparedFile {
    const b = file.buffer;
    const type =
      b.length > 12 && b.subarray(4, 8).toString('latin1') === 'ftyp'
        ? 'video/mp4'
        : b.length > 4 && b.readUInt32BE(0) === 0x1a45dfa3
          ? 'video/webm'
          : null;
    if (!type)
      throw new BadRequestException(
        'ملف الفيديو غير صالح. صوّره من داخل التطبيق',
      );
    if (file.size > VIDEO_MAX_BYTES)
      throw new BadRequestException('الفيديو أطول من اللازم، يكفي 30 ثانية');
    return { buffer: b, type };
  }

  private async createRequest(
    storeId: string,
    kind: VerificationKind,
    prepared: Partial<Record<FileSlot, PreparedFile>>,
    extra: Omit<
      Prisma.VerificationRequestUncheckedCreateInput,
      'storeId' | 'kind' | 'files'
    >,
    actorId: string,
    ip: string,
  ) {
    const files: FileMap = {};
    try {
      for (const [slot, file] of Object.entries(prepared) as [
        FileSlot,
        PreparedFile,
      ][]) {
        const key = `stores/${storeId}/${randomUUID()}`;
        await this.storage.put(key, file.buffer);
        files[slot] = { key, type: file.type, size: file.buffer.length };
      }
    } catch (e) {
      await this.removeFilesQuietly(files);
      this.log.error(`Verification upload failed: ${(e as Error).message}`);
      throw new BadRequestException('تعذّر رفع الملفات، حاول مرة أخرى');
    }

    try {
      const request = await this.prisma.$transaction(
        async (tx) => {
          // Checked again under serializable isolation so two parallel submissions can't both pass
          const pending = await tx.verificationRequest.findFirst({
            where: { storeId, kind, status: 'PENDING' },
            select: { id: true },
          });
          if (pending) throw new ConflictException(PENDING_MESSAGE);
          return tx.verificationRequest.create({
            data: { ...extra, storeId, kind, files },
            select: { id: true, kind: true, status: true, createdAt: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      await this.audit.log({
        actorId,
        action: 'verification.submitted',
        entityType: 'store',
        entityId: storeId,
        meta: { kind, requestId: request.id },
        ip,
      });
      this.notifications.notifyStaff({
        category: 'MODERATION',
        type: 'verification.submitted',
        title:
          kind === 'IDENTITY' ? 'طلب توثيق هوية جديد' : 'طلب توثيق محل جديد',
        body: 'طلب جديد في طابور التوثيق',
        url: '/admin?tab=verifications',
        groupKey: `queue-verification:${damascusDay().toISOString().slice(0, 10)}`,
        grouped: (count) => ({
          title: 'طلبات توثيق جديدة',
          body: `${count} طلبات توثيق تنتظر المراجعة اليوم`,
        }),
      });
      return request;
    } catch (e) {
      await this.removeFilesQuietly(files);
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2034'
      ) {
        throw new ConflictException(PENDING_MESSAGE);
      }
      throw e;
    }
  }

  private async removeFilesQuietly(files: FileMap) {
    try {
      await this.storage.remove(Object.values(files).map((f) => f.key));
    } catch (e) {
      this.log.warn(
        `Could not delete verification files: ${(e as Error).message}`,
      );
    }
  }

  // ---------- admin ----------

  async list(query: Record<string, string>) {
    const { page, pageSize, skip, take } = paging(
      query.page,
      query.pageSize,
      50,
    );
    const status = (
      ['PENDING', 'APPROVED', 'REJECTED'].includes(query.status)
        ? query.status
        : 'PENDING'
    ) as VerificationStatus;
    const where: Prisma.VerificationRequestWhereInput = { status };
    if (query.kind === 'IDENTITY' || query.kind === 'LOCATION')
      where.kind = query.kind;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.verificationRequest.findMany({
        where,
        select: {
          id: true,
          kind: true,
          status: true,
          files: true,
          latitude: true,
          longitude: true,
          accuracyMeters: true,
          capturedAt: true,
          geoCheck: true,
          distanceMeters: true,
          rejectReason: true,
          reviewedAt: true,
          purgedAt: true,
          createdAt: true,
          reviewer: { select: { name: true } },
          store: {
            select: {
              id: true,
              slug: true,
              name: true,
              address: true,
              verificationLevel: true,
              earnedLevel: true,
              governorate: { select: { name: true } },
              market: { select: { name: true, geofenceStatus: true } },
              owner: { select: { name: true, phone: true } },
              _count: {
                select: {
                  verificationRequests: { where: { status: 'REJECTED' } },
                },
              },
            },
          },
        },
        // Oldest first while waiting, so merchants are reviewed in turn
        orderBy:
          status === 'PENDING' ? { createdAt: 'asc' } : { reviewedAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.verificationRequest.count({ where }),
    ]);

    // Storage keys stay on the server; reviewers only see which files are attached
    const safe = items.map(({ files, ...request }) => ({
      ...request,
      files: Object.entries(files as FileMap).map(([slot, f]) => ({
        slot,
        type: f.type,
        size: f.size,
      })),
    }));
    return pageResult(safe, total, page, pageSize);
  }

  async readFile(actorId: string, id: string, slot: string, ip: string) {
    if (!(FILE_SLOTS as readonly string[]).includes(slot))
      throw new NotFoundException('الملف غير موجود');
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id },
      select: { storeId: true, files: true, purgedAt: true },
    });
    if (!request) throw new NotFoundException('طلب التوثيق غير موجود');
    if (request.purgedAt)
      throw new NotFoundException(
        'حُذفت ملفات هذا الطلب بعد انتهاء مدة الاحتفاظ',
      );
    const file = (request.files as FileMap)[slot as FileSlot];
    if (!file) throw new NotFoundException('الملف غير موجود');

    const buffer = await this.storage.get(file.key);
    await this.audit.log({
      actorId,
      action: 'verification.file_viewed',
      entityType: 'verification',
      entityId: id,
      meta: { slot, storeId: request.storeId },
      ip,
    });
    return { buffer, type: file.type };
  }

  async decide(actorId: string, id: string, dto: DecisionDto, ip: string) {
    const request = await this.prisma.verificationRequest.findUnique({
      where: { id },
      select: {
        kind: true,
        status: true,
        latitude: true,
        longitude: true,
        store: {
          select: {
            id: true,
            earnedLevel: true,
            badgeSuspendedAt: true,
            latitude: true,
          },
        },
      },
    });
    if (!request) throw new NotFoundException('طلب التوثيق غير موجود');
    if (request.status !== 'PENDING')
      throw new ConflictException('تمت مراجعة هذا الطلب مسبقاً');
    const { store, kind } = request;
    const reviewed = { reviewerId: actorId, reviewedAt: new Date() };

    if (dto.decision === 'REJECT') {
      const reason = dto.reason?.trim() ?? '';
      if (reason.length < 5)
        throw new BadRequestException(
          'اكتب سبب الرفض ليعرف التاجر ما يجب تصحيحه',
        );
      await this.closeRequest(id, {
        status: 'REJECTED',
        rejectReason: reason,
        ...reviewed,
      });
      await this.audit.log({
        actorId,
        action: 'verification.rejected',
        entityType: 'store',
        entityId: store.id,
        meta: { kind, requestId: id, reason },
        ip,
      });
      this.notifyOwner(store.id, {
        type: 'verification.rejected',
        title:
          kind === 'IDENTITY'
            ? 'لم يُقبل توثيق الهوية'
            : 'لم يُقبل توثيق المحل',
        body: `السبب: ${reason}. صحّح المطلوب وأعد التقديم`,
      });
      return { id, status: 'REJECTED' as const, level: null };
    }

    if (kind === 'LOCATION' && !atLeast(store.earnedLevel, 'IDENTITY')) {
      throw new BadRequestException('يجب توثيق هوية التاجر قبل توثيق المحل');
    }
    const earnedLevel = maxLevel(
      store.earnedLevel,
      kind === 'IDENTITY' ? 'IDENTITY' : 'LOCATION',
    );
    await this.prisma.$transaction(async (tx) => {
      await this.closeRequest(id, { status: 'APPROVED', ...reviewed }, tx);
      await tx.store.update({
        where: { id: store.id },
        data: {
          earnedLevel,
          // A suspended badge stays hidden until an admin restores it
          ...(store.badgeSuspendedAt ? {} : { verificationLevel: earnedLevel }),
          ...(kind === 'LOCATION'
            ? {
                verificationExpiresAt: new Date(
                  Date.now() + VERIFICATION_VALID_DAYS * DAY_MS,
                ),
              }
            : {}),
          ...(kind === 'LOCATION' &&
          store.latitude === null &&
          request.latitude !== null &&
          request.longitude !== null
            ? { latitude: request.latitude, longitude: request.longitude }
            : {}),
        },
      });
    });
    await this.audit.log({
      actorId,
      action: 'verification.approved',
      entityType: 'store',
      entityId: store.id,
      meta: { kind, requestId: id, level: earnedLevel },
      ip,
    });
    this.notifyOwner(store.id, {
      type: 'verification.approved',
      title: kind === 'IDENTITY' ? 'تم توثيق هويتك ✓' : 'تم توثيق محلك ✓',
      body:
        kind === 'IDENTITY'
          ? 'ظهرت شارة «هوية موثّقة» على متجرك، ويمكنك الآن إضافة حتى 50 منتجاً'
          : 'ظهرت شارة «محل موثّق» على متجرك، وصار ظهورك أعلى في البحث بلا حد للمنتجات',
    });
    return { id, status: 'APPROVED' as const, level: earnedLevel };
  }

  /** Closes a request only while it is still pending, so two reviewers can't both decide it. */
  private async closeRequest(
    id: string,
    data: Prisma.VerificationRequestUncheckedUpdateManyInput,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const { count } = await tx.verificationRequest.updateMany({
      where: { id, status: 'PENDING' },
      data,
    });
    if (!count) throw new ConflictException('تمت مراجعة هذا الطلب مسبقاً');
  }

  /**
   * Admin override. PREMIUM is granted after a field visit; lower levels can be revoked. Raising a
   * store to IDENTITY or LOCATION always goes through the merchant's evidence and its review.
   */
  async setStoreLevel(
    actorId: string,
    storeId: string,
    dto: StoreLevelDto,
    ip: string,
  ) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { earnedLevel: true, badgeSuspendedAt: true },
    });
    if (!store) throw new NotFoundException('المتجر غير موجود');
    const { level } = dto;
    if (level === 'PREMIUM' && !atLeast(store.earnedLevel, 'LOCATION')) {
      throw new BadRequestException(
        'التاجر المميز يحتاج توثيق المحل أولاً، ثم زيارة ميدانية',
      );
    }
    if (
      level !== 'PREMIUM' &&
      levelRank(level) > levelRank(store.earnedLevel)
    ) {
      throw new BadRequestException(
        'رفع مستوى التوثيق يتم بطلب من التاجر ومراجعة وثائقه',
      );
    }

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        earnedLevel: level,
        verificationLevel: store.badgeSuspendedAt ? 'REGISTERED' : level,
        ...(atLeast(level, 'LOCATION') ? {} : { verificationExpiresAt: null }),
      },
      select: adminStoreLevelSelect,
    });
    await this.audit.log({
      actorId,
      action: 'store.level_changed',
      entityType: 'store',
      entityId: storeId,
      meta: { from: store.earnedLevel, to: level, note: dto.note.trim() },
      ip,
    });
    if (level !== store.earnedLevel) {
      const names: Record<string, string> = {
        IDENTITY: 'هوية موثّقة',
        LOCATION: 'محل موثّق',
        PREMIUM: 'تاجر مميز',
        REGISTERED: 'مسجّل',
      };
      this.notifyOwner(storeId, {
        type: 'store.level_changed',
        title:
          level === 'PREMIUM'
            ? 'أصبح متجرك «تاجر مميز» ✓'
            : 'تغيّر مستوى توثيق متجرك',
        body: `المستوى الحالي: ${names[level]}`,
      });
    }
    return updated;
  }

  async restoreBadge(
    actorId: string,
    storeId: string,
    note: string,
    ip: string,
  ) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { earnedLevel: true, badgeSuspendedAt: true },
    });
    if (!store) throw new NotFoundException('المتجر غير موجود');
    if (!store.badgeSuspendedAt)
      throw new BadRequestException('شارة هذا المتجر ليست موقوفة');

    const updated = await this.prisma.store.update({
      where: { id: storeId },
      data: {
        verificationLevel: store.earnedLevel,
        badgeSuspendedAt: null,
        badgeRestoredAt: new Date(),
      },
      select: adminStoreLevelSelect,
    });
    await this.audit.log({
      actorId,
      action: 'store.badge_restored',
      entityType: 'store',
      entityId: storeId,
      meta: { note: note.trim() },
      ip,
    });
    this.notifyOwner(storeId, {
      type: 'store.badge_restored',
      title: 'أُعيدت شارة التوثيق لمتجرك',
      body: 'راجعت الإدارة متجرك وأعادت إظهار شارة التوثيق',
    });
    return updated;
  }

  /** Called when a moderator confirms a report: repeated confirmed reports hide the store's badge. */
  async applyReportThreshold(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: {
        earnedLevel: true,
        badgeSuspendedAt: true,
        badgeRestoredAt: true,
      },
    });
    if (!store || store.badgeSuspendedAt || store.earnedLevel === 'REGISTERED')
      return;

    // Reports already weighed before an admin restored the badge don't count again
    const windowStart = Date.now() - BADGE_REPORT_WINDOW_DAYS * DAY_MS;
    const since = new Date(
      Math.max(windowStart, store.badgeRestoredAt?.getTime() ?? 0),
    );
    const confirmed = await this.prisma.report.count({
      where: { storeId, status: 'RESOLVED', createdAt: { gte: since } },
    });
    if (confirmed < BADGE_REPORT_THRESHOLD) return;

    const { count } = await this.prisma.store.updateMany({
      where: { id: storeId, badgeSuspendedAt: null },
      data: { badgeSuspendedAt: new Date(), verificationLevel: 'REGISTERED' },
    });
    if (count) {
      await this.audit.log({
        action: 'store.badge_suspended',
        entityType: 'store',
        entityId: storeId,
        meta: { confirmedReports: confirmed },
      });
      this.notifyOwner(storeId, {
        type: 'store.badge_suspended',
        title: 'أُوقفت شارة التوثيق مؤقتاً',
        body: 'تكررت بلاغات مؤكدة على متجرك، فأُخفيت الشارة حتى تراجعها الإدارة. تواصل معنا للتوضيح',
      });
    }
  }

  // ---------- scheduled upkeep ----------

  /** Expires yearly shop verification and deletes evidence of rejected requests after retention. */
  async runMaintenance() {
    try {
      const now = new Date();
      const expired = await this.prisma.store.findMany({
        where: { verificationExpiresAt: { lt: now } },
        select: { id: true, badgeSuspendedAt: true },
      });
      for (const store of expired) {
        await this.prisma.store.update({
          where: { id: store.id },
          data: {
            earnedLevel: 'IDENTITY',
            verificationLevel: store.badgeSuspendedAt
              ? 'REGISTERED'
              : 'IDENTITY',
            verificationExpiresAt: null,
          },
        });
        await this.audit.log({
          action: 'store.verification_expired',
          entityType: 'store',
          entityId: store.id,
        });
        this.notifyOwner(store.id, {
          type: 'verification.expired',
          title: 'انتهى توثيق محلك',
          body: 'مرّ عام على توثيق المحل. صوّر فيديو جديداً من صفحة التوثيق لاستعادة الشارة',
        });
      }

      const cutoff = new Date(
        now.getTime() - REJECTED_FILES_RETENTION_DAYS * DAY_MS,
      );
      const stale = await this.prisma.verificationRequest.findMany({
        where: {
          status: 'REJECTED',
          reviewedAt: { lt: cutoff },
          purgedAt: null,
        },
        select: { id: true, files: true },
        take: 200,
      });
      let purged = 0;
      for (const request of stale) {
        try {
          await this.storage.remove(
            Object.values(request.files as FileMap).map((f) => f.key),
          );
          await this.prisma.verificationRequest.update({
            where: { id: request.id },
            data: { files: {}, purgedAt: now },
          });
          purged++;
        } catch (e) {
          this.log.warn(
            `Could not purge verification ${request.id}: ${(e as Error).message}`,
          );
        }
      }
      // Failed sign-ins only matter for an hour (the owner alert); a day is plenty to keep
      await this.prisma.loginFailure.deleteMany({
        where: { createdAt: { lt: new Date(now.getTime() - DAY_MS) } },
      });

      if (expired.length || purged)
        this.log.log(
          `Verification upkeep: ${expired.length} expired, ${purged} purged`,
        );
    } catch (e) {
      this.log.error(`Verification upkeep failed: ${(e as Error).message}`);
    }
  }
}
