import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Auth } from '../auth/guards';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/current-user.decorator';
import { MediaService, MAX_UPLOAD_BYTES } from './media.service';

type UploadedImage = { buffer: Buffer; mimetype: string; size: number };

@Controller('merchant/media')
@Auth('MERCHANT', 'ADMIN')
export class MediaController {
  constructor(private media: MediaService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  upload(@CurrentUser() user: AuthUser, @UploadedFile() file?: UploadedImage) {
    if (!file) throw new BadRequestException('لم يتم إرفاق صورة');
    return this.media.uploadImage(user.id, file);
  }
}
