import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SubscriptionsFacade } from './services/subscriptions.facade';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsFacade: SubscriptionsFacade) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionsFacade.create(createSubscriptionDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  findAll() {
    return this.subscriptionsFacade.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.subscriptionsFacade.findOne(id);
  }

  @Get('school/:id')
  @UseGuards(JwtAuthGuard)
  findBySchool(@Param('id') id: string) {
    return this.subscriptionsFacade.findBySchool(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() updateSubscriptionDto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionsFacade.update(id, updateSubscriptionDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.subscriptionsFacade.remove(id);
  }

  @Get('validate/user-limit')
  @UseGuards(JwtAuthGuard)
  validateUserLimit(@Query('schoolId') schoolId: string) {
    return this.subscriptionsFacade.validateUserLimit(schoolId);
  }

  @Get('validate/enrollment')
  @UseGuards(JwtAuthGuard)
  validateEnrollment(
    @Query('userId') userId: string,
    @Query('courseId') courseId: string,
  ) {
    return this.subscriptionsFacade.validateEnrollment(
      userId,
      courseId,
    );
  }

  @Get('validate/storage')
  @UseGuards(JwtAuthGuard)
  validateStorage(
    @Query('schoolId') schoolId: string,
    @Query('requiredGb') requiredGb: number,
  ) {
    return this.subscriptionsFacade.validateStorage(
      schoolId,
      requiredGb,
    );
  }
}
