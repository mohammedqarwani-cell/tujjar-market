import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditEntry = {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  meta?: Prisma.InputJsonValue;
  ip?: string;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private prisma: PrismaService) {}

  /** Never throws: a failed audit write must not break the user's action, but it is logged. */
  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({ data: entry });
    } catch (e) {
      this.logger.error(`Audit write failed for ${entry.action}`, (e as Error).stack);
    }
  }
}

@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
