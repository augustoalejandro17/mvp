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
  Logger, 
  BadRequestException, 
  NotFoundException
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { CoursesService } from './courses.service';
import { EnrollmentDto } from './dto/enrollment.dto';
import { UpdateEnrollmentDto } from './dto/update-enrollment.dto';

@Controller('enrollments')
export class EnrollmentsController {
  private readonly logger = new Logger(EnrollmentsController.name);

  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  async findAll(@Req() req) {
    
    const userId = req.user.sub;
    return this.coursesService.getAllEnrollments(userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req) {
    
    const userId = req.user.sub;
    const userRole = req.user.role;
    
    return this.coursesService.getEnrollmentById(id, userId, userRole);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SCHOOL_OWNER, UserRole.TEACHER, UserRole.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateEnrollmentDto: UpdateEnrollmentDto,
    @Req() req
  ) {
    
    
    const userId = req.user.sub;
    updateEnrollmentDto.updatedBy = userId;
    
    return this.coursesService.updateEnrollment(id, updateEnrollmentDto, userId, req.user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  async remove(@Param('id') id: string, @Req() req) {
    
    const userId = req.user.sub;
    
    return this.coursesService.removeEnrollment(id, userId);
  }
} 