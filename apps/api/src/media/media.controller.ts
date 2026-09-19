import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '../common/throttle';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import {
  MediaService,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_BYTES,
} from './media.service';

type UploadedImage = { buffer: Buffer; size: number };

@Controller('merchant/media')
@Auth('MERCHANT')
export class MediaController {
  constructor(private media: MediaService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 3600_000 } })
  // Tight multipart limits reduce exposure to malformed-form DoS attacks on multer
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_UPLOAD_BYTES,
        files: 1,
        fields: 2,
        parts: 3,
        fieldNameSize: 50,
        fieldSize: 1024,
        headerPairs: 50,
      },
    }),
  )
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('لم يتم إرفاق صورة');
    return this.media.uploadImage(user.id, file);
  }

  /** Short videos for reels and statuses. */
  @Post('video')
  @Throttle({ default: { limit: 20, ttl: 3600_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_VIDEO_BYTES,
        files: 1,
        fields: 2,
        parts: 3,
        fieldNameSize: 50,
        fieldSize: 1024,
        headerPairs: 50,
      },
    }),
  )
  uploadVideo(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: UploadedImage,
  ) {
    if (!file) throw new BadRequestException('لم يتم إرفاق فيديو');
    return this.media.uploadVideo(user.id, file);
  }
}

/** Pictures the platform team uses in its own content (homepage banners). */
@Controller('admin/media')
@Auth('ADMIN', 'MODERATOR')
export class AdminMediaController {
  constructor(private media: MediaService) {}

  @Post()
  @Throttle({ default: { limit: 60, ttl: 3600_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_UPLOAD_BYTES,
        files: 1,
        fields: 2,
        parts: 3,
        fieldNameSize: 50,
        fieldSize: 1024,
        headerPairs: 50,
      },
    }),
  )
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('لم يتم إرفاق صورة');
    return this.media.uploadImage(user.id, file);
  }
}
