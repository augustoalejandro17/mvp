import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
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
      }
    };
  }
} 