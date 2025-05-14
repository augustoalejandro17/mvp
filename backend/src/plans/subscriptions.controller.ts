import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query, Request } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(createSubscriptionDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  findAll() {
    return this.subscriptionsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.subscriptionsService.findOne(id);
  }

  @Get('school/:id')
  @UseGuards(JwtAuthGuard)
  findBySchool(@Param('id') id: string) {
    return this.subscriptionsService.findBySchool(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateSubscriptionDto: UpdateSubscriptionDto) {
    return this.subscriptionsService.update(id, updateSubscriptionDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.subscriptionsService.remove(id);
  }

  @Get('validate/user-limit')
  @UseGuards(JwtAuthGuard)
  validateUserLimit(@Query('schoolId') schoolId: string) {
    return this.subscriptionsService.canAddUserToSchool(schoolId);
  }

  @Get('validate/enrollment')
  @UseGuards(JwtAuthGuard)
  validateEnrollment(
    @Query('userId') userId: string,
    @Query('courseId') courseId: string
  ) {
    return this.subscriptionsService.canEnrollUserToCourse(userId, courseId);
  }

  @Get('validate/storage')
  @UseGuards(JwtAuthGuard)
  validateStorage(
    @Query('schoolId') schoolId: string,
    @Query('requiredGb') requiredGb: number
  ) {
    return this.subscriptionsService.hasAvailableStorage(schoolId, requiredGb);
  }
} 