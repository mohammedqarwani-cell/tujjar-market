import { Body, Controller, Post } from '@nestjs/common';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload-url')
  async getUploadUrl(@Body() body: { contentType: string }) {
    return this.mediaService.getUploadUrl(body.contentType);
  }
}
