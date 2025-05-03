import { Controller, Get } from '@nestjs/common';
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
      fullPath: '/test-route' // This will show up as /api/test-route due to global prefix
    };
  }

  @Get('admin/stats/test')
  adminStatsTest() {
    return {
      message: 'Admin stats test endpoint is working without auth!',
      path: 'admin/stats/test',
      fullPath: '/admin/stats/test' // This will show up as /api/admin/stats/test
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
      }
    };
  }
} 