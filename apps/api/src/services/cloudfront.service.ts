import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Previously CloudFrontService, now serves as the R2 CDN URL builder.
 * Cloudflare R2 serves files publicly via a custom domain (or r2.dev subdomain)
 * configured in the R2_PUBLIC_DOMAIN env var. No signing keys required.
 *
 * Class name is kept to avoid renaming imports across the codebase.
 */
@Injectable()
export class CloudFrontService {
  private readonly logger = new Logger(CloudFrontService.name);
  private readonly publicDomain: string;

  constructor(private configService: ConfigService) {
    const raw = this.configService.get<string>('aws.r2.publicDomain');
    if (raw) {
      this.publicDomain = raw.replace(/^https?:\/\//, '').replace(/\/$/, '');
    }

    if (!this.publicDomain) {
      this.logger.warn(
        'R2_PUBLIC_DOMAIN is not set. File URLs will fall back to R2 presigned URLs.',
      );
    }
  }

  /**
   * Returns the public CDN URL for a given R2 object key.
   * The `expiresIn` parameter is ignored because R2 public bucket URLs do not expire.
   * If no public domain is configured an error is thrown so the caller can fall back
   * to a presigned URL generated directly by S3Service.
   */
  async getSignedUrl(objectKey: string, _expiresIn: number = 3600): Promise<string> {
    if (!this.publicDomain) {
      throw new Error(
        'R2_PUBLIC_DOMAIN is not configured. Cannot build CDN URL.',
      );
    }
    return `https://${this.publicDomain}/${objectKey}`;
  }

  /**
   * Builds a plain (non-expiring) public R2 CDN URL.
   */
  getObjectUrl(key: string): string {
    if (!this.publicDomain) {
      throw new Error('R2_PUBLIC_DOMAIN is not configured.');
    }
    return `https://${this.publicDomain}/${key}`;
  }

  /**
   * R2 public bucket does not require cookie-based access control.
   * Returns an empty object to maintain API compatibility.
   */
  getCookies(_expiresIn: number = 3600): Record<string, string> {
    return {};
  }
}
