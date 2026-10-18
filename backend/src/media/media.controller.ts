import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MediaService } from './media.service';

@Controller('media')
@UseGuards(AuthGuard('jwt'))
export class MediaController {
  constructor(private svc: MediaService) {}

  @Post('upload-url')
  getUploadUrl(@Request() req: any, @Body() body: { mime: string; size: number }) {
    return this.svc.getUploadUrl(body.mime, body.size, req.user.userId);
  }

  @Post('upload')
  uploadDirect(@Request() req: any, @Body() body: { file: string; mime: string }) {
    return this.svc.uploadDirect(body.file, body.mime, req.user.userId);
  }
}
