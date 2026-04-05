import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { UserRole } from './auth/schemas/user.schema';
import { AppFacade } from './services/app.facade';

@Controller()
export class AppController {
  constructor(private readonly appFacade: AppFacade) {}

  @Get()
  getHello(): string {
    return this.appFacade.getHello();
  }

  @Get('test-route')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  testRoute() {
    return this.appFacade.getTestRoute();
  }

  @Get('admin/stats/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  adminStatsTest() {
    return this.appFacade.getAdminStatsTest();
  }

  @Get('admin/stats/public-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  publicStatsTest() {
    return this.appFacade.getPublicStatsTest();
  }

  @Get('health')
  healthCheck() {
    return this.appFacade.getHealth();
  }

  @Get('debug/cloudfront')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  debugCloudFront() {
    return this.appFacade.getCloudFrontDebug();
  }

  // TEMPORARY: Remove after testing
  @Get('trigger-snapshots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async triggerSnapshots(): Promise<any> {
    return this.appFacade.triggerSnapshots();
  }
}
