import { Injectable, BadRequestException } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

// Allowed MIME types
const ALLOWED = new Set([
  'image/jpeg','image/png','image/webp','image/gif',
  'audio/webm','audio/ogg','audio/mp4','audio/mpeg',
  'video/mp4','video/webm',
  'application/pdf',
]);

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

@Injectable()
export class MediaService {
  private ensureConfig() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /** Direct base64 upload to Cloudinary with safe fallback */
  async uploadDirect(base64Data: string, mime: string, userId: string) {
    if (!ALLOWED.has(mime)) {
      throw new BadRequestException({ error: { code: 'INVALID_MIME', message: 'File type not allowed' } });
    }
    this.ensureConfig();

    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
      try {
        const uploadStr = base64Data.startsWith('data:') ? base64Data : `data:${mime};base64,${base64Data}`;
        const res = await cloudinary.uploader.upload(uploadStr, {
          folder: `together/${userId}`,
          resource_type: 'auto',
        });
        return { url: res.secure_url, mediaId: res.public_id };
      } catch (err) {
        console.warn('Cloudinary upload warning, falling back to data URL:', (err as any)?.message);
      }
    }

    const dataUrl = base64Data.startsWith('data:') ? base64Data : `data:${mime};base64,${base64Data}`;
    return { url: dataUrl, mediaId: 'inline' };
  }

  /** Generate a signed Cloudinary upload URL (client uploads directly) */
  async getUploadUrl(mime: string, size: number, userId: string) {
    if (!ALLOWED.has(mime)) throw new BadRequestException({ error: { code: 'INVALID_MIME', message: 'File type not allowed' } });
    if (size > MAX_BYTES) throw new BadRequestException({ error: { code: 'TOO_LARGE', message: 'Max file size is 50 MB' } });
    this.ensureConfig();

    const timestamp = Math.round(Date.now() / 1000);
    const folder = `together/${userId}`;
    const signature = cloudinary.utils.api_sign_request({ timestamp, folder }, process.env.CLOUDINARY_API_SECRET || 'secret');

    return {
      uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME || 'demo'}/auto/upload`,
      fields: { timestamp, folder, api_key: process.env.CLOUDINARY_API_KEY || '', signature },
    };
  }

  /** Delete a Cloudinary asset by public_id */
  async deleteAsset(publicId: string) {
    this.ensureConfig();
    return cloudinary.uploader.destroy(publicId);
  }
}
