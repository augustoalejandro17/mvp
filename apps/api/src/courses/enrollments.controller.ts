import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { CourseEnrollmentsFacade } from './services/enrollments.facade';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Controller('enrollments')
export class EnrollmentsController {
  constructor(
    private readonly courseEnrollmentsFacade: CourseEnrollmentsFacade,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  async findAll(@Req() req) {
    return this.courseEnrollmentsFacade.findAll(req);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req) {
    return this.courseEnrollmentsFacade.findOne(id, req);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.TEACHER,
    UserRole.SUPER_ADMIN,
  )
  async update(
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
    @Req() req,
  ) {
    return this.courseEnrollmentsFacade.update(
      id,
      updateEnrollmentDto,
      req,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @Req() req) {
    return this.courseEnrollmentsFacade.remove(id, req);
  }
}
