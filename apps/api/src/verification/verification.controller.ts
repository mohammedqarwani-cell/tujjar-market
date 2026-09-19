import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { Throttle } from '../common/throttle';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { clientIp } from '../common/request';
import {
  DecisionDto,
  LocationEvidenceDto,
  RestoreBadgeDto,
  StoreLevelDto,
} from './verification.dto';
import {
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  VerificationService,
  type FileSlot,
  type UploadedFile,
} from './verification.service';

type Uploads = Partial<Record<FileSlot, UploadedFile[]>>;
const firstOfEach = (uploads?: Uploads) =>
  Object.fromEntries(
    Object.entries(uploads ?? {}).map(([slot, list]) => [slot, list?.[0]]),
  ) as Partial<Record<FileSlot, UploadedFile>>;

// Evidence uploads are the largest bodies the API accepts, so every other multipart limit stays tight
const multipartLimits = { fieldNameSize: 20, fieldSize: 64, headerPairs: 50 };

@Controller('merchant/verification')
@Auth('MERCHANT')
export class MerchantVerificationController {
  constructor(private verification: VerificationService) {}

  @Get()
  status(@CurrentUser() user: AuthUser) {
    return this.verification.status(user.id);
  }

  @Post('identity')
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'idFront', maxCount: 1 },
        { name: 'idBack', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
      ],
      {
        limits: {
          ...multipartLimits,
          fileSize: IMAGE_MAX_BYTES,
          files: 3,
          fields: 0,
          parts: 3,
        },
      },
    ),
  )
  identity(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() uploads: Uploads,
    @Req() req: Request,
  ) {
    return this.verification.submitIdentity(
      user.id,
      firstOfEach(uploads),
      clientIp(req),
    );
  }

  @Post('location')
  @Throttle({ default: { limit: 10, ttl: 3600_000 } })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'video', maxCount: 1 },
        { name: 'document', maxCount: 1 },
      ],
      {
        limits: {
          ...multipartLimits,
          fileSize: VIDEO_MAX_BYTES,
          files: 2,
          fields: 4,
          parts: 6,
        },
      },
    ),
  )
  location(
    @CurrentUser() user: AuthUser,
    @UploadedFiles() uploads: Uploads,
    @Body() evidence: LocationEvidenceDto,
    @Req() req: Request,
  ) {
    return this.verification.submitLocation(
      user.id,
      firstOfEach(uploads),
      evidence,
      clientIp(req),
    );
  }
}

@Controller('admin')
@Auth('ADMIN', 'MODERATOR')
export class AdminVerificationController {
  constructor(private verification: VerificationService) {}

  @Get('verifications')
  list(@Query() query: Record<string, string>) {
    return this.verification.list(query);
  }

  /** Streams one decrypted evidence file; every view is written to the audit log. */
  @Get('verifications/:id/files/:slot')
  async file(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Param('slot') slot: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, type } = await this.verification.readFile(
      actor.id,
      id,
      slot,
      clientIp(req),
    );
    // Identity documents must never be cached by the browser or any proxy
    res.set({
      'Cache-Control': 'no-store, private',
      'Content-Disposition': 'inline',
    });
    return new StreamableFile(buffer, { type, length: buffer.length });
  }

  @Patch('verifications/:id')
  decide(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
    @Req() req: Request,
  ) {
    return this.verification.decide(actor.id, id, dto, clientIp(req));
  }

  @Patch('stores/:id/level')
  @Auth('ADMIN')
  setLevel(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: StoreLevelDto,
    @Req() req: Request,
  ) {
    return this.verification.setStoreLevel(actor.id, id, dto, clientIp(req));
  }

  @Patch('stores/:id/badge')
  @Auth('ADMIN')
  restoreBadge(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body() dto: RestoreBadgeDto,
    @Req() req: Request,
  ) {
    return this.verification.restoreBadge(
      actor.id,
      id,
      dto.note,
      clientIp(req),
    );
  }
}
