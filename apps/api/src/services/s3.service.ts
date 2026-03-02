import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3 } from 'aws-sdk';
import { CloudFrontService } from './cloudfront.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Storage service backed by Cloudflare R2.
 * R2 is fully S3-compatible so we keep the same `aws-sdk` S3 client,
 * just pointing it at the R2 endpoint instead of AWS.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_TEMP_BUCKET_NAME, R2_PUBLIC_DOMAIN
 */
@Injectable()
export class S3Service {
  private readonly s3: S3;
  private readonly logger = new Logger(S3Service.name);
  private readonly bucketName: string;
  private readonly tempBucketName: string;
  private readonly publicDomain: string;

  constructor(
    private configService: ConfigService,
    private cloudFrontService: CloudFrontService,
  ) {
    const accountId = this.configService.get<string>('aws.r2.accountId');
    const accessKeyId = this.configService.get<string>('aws.r2.accessKeyId');
    const secretAccessKey = this.configService.get<string>(
      'aws.r2.secretAccessKey',
    );

    this.s3 = new S3({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      accessKeyId,
      secretAccessKey,
      region: 'auto',
      signatureVersion: 'v4',
      s3ForcePathStyle: true,
    });

    this.bucketName = this.configService.get<string>('aws.r2.bucketName');
    this.tempBucketName = this.configService.get<string>(
      'aws.r2.tempBucketName',
    );

    const rawDomain = this.configService.get<string>('aws.r2.publicDomain');
    if (rawDomain) {
      this.publicDomain = rawDomain
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }

  private getContentType(
    key: string,
    fallback = 'application/octet-stream',
  ): string {
    if (key.endsWith('.mp4') || key.endsWith('.webm')) return 'video/mp4';
    if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
    if (key.endsWith('.png')) return 'image/png';
    if (key.endsWith('.gif')) return 'image/gif';
    if (key.includes('/images/')) return 'image/jpeg';
    return fallback;
  }

  /**
   * Build the CDN URL for a key.
   * Uses the R2 public domain if available, otherwise falls back to an R2 presigned URL.
   */
  private async buildUrl(key: string, expiresIn = 86400): Promise<string> {
    if (this.publicDomain) {
      return `https://${this.publicDomain}/${key}`;
    }

    // Fallback: presigned R2 URL
    const contentType = this.getContentType(key);
    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucketName,
      Key: key,
      Expires: expiresIn,
      ResponseContentType: contentType,
      ResponseCacheControl: 'max-age=3600',
    });
  }

  // ---------------------------------------------------------------------------
  // Public API (same signatures as the original S3Service)
  // ---------------------------------------------------------------------------

  async uploadVideo(file: Express.Multer.File): Promise<string> {
    const fileExtension = file.originalname.split('.').pop();
    const key = `videos/${uuidv4()}.${fileExtension}`;

    await this.s3
      .upload({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: 'video/mp4',
        ContentDisposition: 'inline',
        CacheControl: 'max-age=31536000',
      })
      .promise();

    this.logger.log(`Video uploaded to R2: ${key}, size: ${file.size} bytes`);

    return this.buildUrl(key);
  }

  async getSignedUrl(
    key: string,
    expiresIn: number = 3600,
    contentType?: string,
  ): Promise<string> {
    if (!key) {
      throw new Error('Object key cannot be empty');
    }

    let cleanKey = key;
    if (
      key.includes('amazonaws.com') ||
      key.includes('r2.cloudflarestorage.com')
    ) {
      cleanKey = this.getKeyFromUrl(key);
    }

    if (this.publicDomain) {
      return `https://${this.publicDomain}/${cleanKey}`;
    }

    return this.s3.getSignedUrlPromise('getObject', {
      Bucket: this.bucketName,
      Key: cleanKey,
      Expires: expiresIn,
      ResponseContentType: contentType ?? this.getContentType(cleanKey),
      ResponseCacheControl: 'max-age=3600',
    });
  }

  async deleteVideo(videoUrl: string): Promise<void> {
    if (!videoUrl) {
      this.logger.warn('deleteVideo called with empty URL');
      return;
    }

    let key: string;
    try {
      key = this.getKeyFromUrl(videoUrl);
    } catch (e) {
      this.logger.error(`Could not extract key from URL: ${videoUrl}`);
      return;
    }

    try {
      await this.s3
        .deleteObject({ Bucket: this.bucketName, Key: key })
        .promise();
      this.logger.log(`Deleted from R2: ${key}`);
    } catch (error) {
      if (error.code === 'AccessDenied') {
        this.logger.warn(`Access denied deleting ${key}. File remains in R2.`);
        return;
      }
      this.logger.error(`Error deleting ${key}: ${error.message}`, error.stack);
    }
  }

  public getKeyFromUrl(url: string): string {
    let cleanUrl = url.includes('?') ? url.split('?')[0] : url;

    try {
      const { hostname, pathname } = new URL(cleanUrl);
      let path = pathname.startsWith('/') ? pathname.substring(1) : pathname;

      // Cloudflare R2 public domain (custom domain or r2.dev)
      if (this.publicDomain && hostname.includes(this.publicDomain)) {
        return path;
      }

      // R2 storage endpoint: account-id.r2.cloudflarestorage.com/bucket/key
      if (hostname.includes('r2.cloudflarestorage.com')) {
        const parts = path.split('/');
        return parts[0] === this.bucketName ? parts.slice(1).join('/') : path;
      }

      // Legacy AWS S3: bucket.s3.region.amazonaws.com/key
      if (hostname.includes(this.bucketName)) {
        return path;
      }

      // Legacy AWS S3 path style: s3.amazonaws.com/bucket/key
      if (hostname.includes('s3.amazonaws.com')) {
        const parts = path.split('/');
        return parts[0] === this.bucketName ? parts.slice(1).join('/') : path;
      }

      return path;
    } catch {
      // Fallback for non-URL strings
      if (cleanUrl.includes('/videos/')) {
        return `videos/${cleanUrl.split('/videos/')[1]}`;
      }
      return cleanUrl;
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalname: string,
    mimetype: string,
  ): Promise<{ url: string; key: string }> {
    const sanitizedName = this.sanitizeFileName(originalname.split('.')[0]);
    const key = `videos/${sanitizedName}-${Date.now()}.mp4`;

    await this.s3
      .upload({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4',
        ContentDisposition: 'inline',
        CacheControl: 'max-age=31536000',
      })
      .promise();

    const url = await this.buildUrl(key);
    return { url, key };
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const sanitizedName = this.sanitizeFileName(
      file.originalname.split('.')[0],
    );
    const timestamp = Date.now();
    const key = `images/${sanitizedName}-${timestamp}-${uuidv4()}.${fileExtension}`;

    await this.s3
      .upload({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'max-age=3600',
        ContentDisposition: 'inline',
      })
      .promise();

    const baseUrl = await this.buildUrl(key);
    return baseUrl.includes('?')
      ? `${baseUrl}&t=${timestamp}`
      : `${baseUrl}?t=${timestamp}`;
  }

  async generatePresignedUploadUrl(
    fileName: string,
    fileType: string,
    schoolId: string,
    classId: string,
  ): Promise<{ uploadUrl: string; key: string }> {
    const fileExtension = fileName.split('.').pop() || 'mp4';
    const sanitizedName = this.sanitizeFileName(fileName.split('.')[0]);
    const key = `temp-videos/${schoolId}/${classId}/${sanitizedName}-${Date.now()}.${fileExtension}`;

    const uploadUrl = await this.s3.getSignedUrlPromise('putObject', {
      Bucket: this.tempBucketName,
      Key: key,
      Expires: 3600,
      ContentType: fileType,
    });

    this.logger.log(`Generated presigned upload URL for R2: ${key}`);
    return { uploadUrl, key };
  }

  async moveProcessedVideo(
    tempKey: string,
    schoolId: string,
    classId: string,
    originalFileName: string,
  ): Promise<string> {
    const finalKey = `videos/${schoolId}/${classId}/final.mp4`;

    await this.s3
      .copyObject({
        Bucket: this.bucketName,
        CopySource: `${this.tempBucketName}/${tempKey}`,
        Key: finalKey,
        ContentType: 'video/mp4',
        MetadataDirective: 'REPLACE',
        ContentDisposition: 'inline',
        CacheControl: 'max-age=31536000',
      })
      .promise();

    this.logger.log(`Video moved in R2: ${tempKey} → ${finalKey}`);

    await this.deleteFromTempBucket(tempKey);

    return this.buildUrl(finalKey);
  }

  async downloadFromTempBucket(key: string): Promise<Buffer> {
    const result = await this.s3
      .getObject({ Bucket: this.tempBucketName, Key: key })
      .promise();

    if (!result.Body) {
      throw new Error(`Empty body for key: ${key}`);
    }

    return result.Body as Buffer;
  }

  async uploadProcessedVideo(
    buffer: Buffer,
    schoolId: string,
    classId: string,
    originalFileName: string,
  ): Promise<string> {
    const key = `videos/${schoolId}/${classId}/final.mp4`;

    await this.s3
      .upload({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: 'video/mp4',
        ContentDisposition: 'inline',
        CacheControl: 'max-age=31536000',
      })
      .promise();

    this.logger.log(
      `Processed video uploaded to R2: ${key}, size: ${buffer.length} bytes`,
    );

    return this.buildUrl(key);
  }

  async deleteFromTempBucket(key: string): Promise<void> {
    try {
      await this.s3
        .deleteObject({ Bucket: this.tempBucketName, Key: key })
        .promise();
      this.logger.log(`Deleted from R2 temp bucket: ${key}`);
    } catch (error) {
      this.logger.error(
        `Error deleting from temp bucket (${key}): ${error.message}`,
      );
    }
  }
}
