import { registerAs } from '@nestjs/config';

export default registerAs('aws', () => ({
  // Cloudflare R2 (S3-compatible storage)
  r2: {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    bucketName: process.env.R2_BUCKET_NAME,
    tempBucketName: process.env.R2_TEMP_BUCKET_NAME,
    // Custom domain or r2.dev subdomain for public file access (e.g. media.yourdomain.com)
    publicDomain: process.env.R2_PUBLIC_DOMAIN,
  },

  // Legacy AWS fields kept for backward compatibility during migration
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  s3: {
    bucketName: process.env.AWS_S3_BUCKET_NAME,
    tempBucketName: process.env.AWS_S3_TEMP_BUCKET_NAME,
  },
  cloudFrontDomain: process.env.AWS_CLOUDFRONT_DOMAIN,
  cloudFrontKeyPairId: process.env.AWS_CLOUDFRONT_KEY_PAIR_ID,
  cloudFrontPrivateKeyPath: process.env.AWS_CLOUDFRONT_PRIVATE_KEY_PATH,
  cloudFrontPrivateKeyBase64: process.env.AWS_CLOUDFRONT_PRIVATE_KEY_BASE64,
}));
