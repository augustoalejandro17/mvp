import { Injectable } from '@nestjs/common';
import { AppService } from '../app.service';

@Injectable()
export class AppFacade {
  constructor(private readonly appService: AppService) {}

  getHello(): string {
    return this.appService.getHello();
  }

  getTestRoute() {
    return {
      message: 'Test endpoint is working!',
      path: 'test-route',
      fullPath: '/test-route',
    };
  }

  getAdminStatsTest() {
    return {
      message: 'Admin stats test endpoint is working without auth!',
      path: 'admin/stats/test',
      fullPath: '/admin/stats/test',
    };
  }

  getPublicStatsTest() {
    return {
      message: 'Admin stats debug endpoint',
      path: '/admin/stats/public-test',
      timestamp: new Date().toISOString(),
    };
  }

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'api',
    };
  }

  getCloudFrontDebug() {
    const cloudFrontDomain =
      process.env.AWS_CLOUDFRONT_DOMAIN || 'no configurado';
    const cloudFrontKeyPairId =
      process.env.AWS_CLOUDFRONT_KEY_PAIR_ID || 'no configurado';
    const hasPrivateKeyBase64 = !!process.env.AWS_CLOUDFRONT_PRIVATE_KEY_BASE64;
    const hasPrivateKeyPath = !!process.env.AWS_CLOUDFRONT_PRIVATE_KEY_PATH;
    const privateKeyMethod = hasPrivateKeyBase64
      ? 'Base64'
      : hasPrivateKeyPath
        ? 'Path'
        : 'No configurado';

    return {
      cloudFrontDomain,
      cloudFrontKeyPairId,
      privateKeyMethod,
      hasPrivateKeyBase64,
      hasPrivateKeyPath,
      region: process.env.AWS_REGION || 'us-east-1',
      s3BucketName: process.env.AWS_S3_BUCKET_NAME || 'no configurado',
      credsAvailable: !!(
        process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ),
    };
  }

  triggerSnapshots() {
    return {
      success: true,
      message: 'Trigger endpoint created - but needs proper service injection',
      timestamp: new Date().toISOString(),
    };
  }
}
