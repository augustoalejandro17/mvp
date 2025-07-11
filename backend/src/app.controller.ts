import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-route')
  testRoute() {
    return {
      message: 'Test endpoint is working!',
      path: 'test-route',
      fullPath: '/test-route', // This will show up as /api/test-route due to global prefix
    };
  }

  @Get('admin/stats/test')
  adminStatsTest() {
    return {
      message: 'Admin stats test endpoint is working without auth!',
      path: 'admin/stats/test',
      fullPath: '/admin/stats/test', // This will show up as /api/admin/stats/test
    };
  }

  @Get('admin/stats/public-test')
  publicStatsTest() {
    return {
      message: 'Public admin stats test endpoint is working without auth!',
      path: '/admin/stats/public-test',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      cloudfront: {
        enabled: !!process.env.AWS_CLOUDFRONT_DOMAIN,
        domain: process.env.AWS_CLOUDFRONT_DOMAIN,
        keyPairId: process.env.AWS_CLOUDFRONT_KEY_PAIR_ID ? '✓' : '✗',
        privateKey: process.env.AWS_CLOUDFRONT_PRIVATE_KEY_PATH ? '✓' : '✗',
      },
      environment: process.env.NODE_ENV || 'development',
    };
  }

  @Get('debug/cloudfront')
  debugCloudFront() {
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

  // TEMPORARY: Remove after testing
  @Get('trigger-snapshots')
  async triggerSnapshots(): Promise<any> {
    try {
      console.log('🚀 Manually triggering snapshot generation...');

      // This is a simplified approach - in a real scenario we'd need proper DI
      return {
        success: true,
        message:
          'Trigger endpoint created - but needs proper service injection',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('❌ Error:', error);
      return {
        success: false,
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
