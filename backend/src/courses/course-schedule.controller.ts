import { 
  Controller, 
  Get, 
  Post, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards,
  Request,
  BadRequestException
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CourseScheduleService } from './course-schedule.service';
import { CreateCourseScheduleDto, UpdateCourseScheduleDto } from './dto/course-schedule.dto';
import { CoursesService } from './courses.service';

@Controller('courses/:courseId/schedule')
@UseGuards(JwtAuthGuard)
export class CourseScheduleController {
  constructor(
    private readonly courseScheduleService: CourseScheduleService,
    private readonly coursesService: CoursesService
  ) {}

  @Post()
  async createSchedule(
    @Param('courseId') courseId: string,
    @Body() createScheduleDto: CreateCourseScheduleDto,
    @Request() req
  ) {
    // Verify user has permission to modify this course
    const course = await this.coursesService.findOne(courseId);
    const userId = req.user.id;
    
    // Check if user is the teacher or has admin permissions
    const isTeacher = (course.teacher as any)._id.toString() === userId || 
                     course.teachers.some(t => t.toString() === userId);
    
    if (!isTeacher && req.user.role !== 'admin') {
      throw new BadRequestException('No tienes permisos para configurar el horario de este curso');
    }

    return this.courseScheduleService.createSchedule(courseId, createScheduleDto);
  }

  @Get()
  async getSchedule(@Param('courseId') courseId: string) {
    return this.courseScheduleService.getSchedule(courseId);
  }

  @Put()
  async updateSchedule(
    @Param('courseId') courseId: string,
    @Body() updateScheduleDto: UpdateCourseScheduleDto,
    @Request() req
  ) {
    // Verify user has permission to modify this course
    const course = await this.coursesService.findOne(courseId);
    const userId = req.user.id;
    
    const isTeacher = (course.teacher as any)._id.toString() === userId || 
                     course.teachers.some(t => t.toString() === userId);
    
    if (!isTeacher && req.user.role !== 'admin') {
      throw new BadRequestException('No tienes permisos para configurar el horario de este curso');
    }

    return this.courseScheduleService.updateSchedule(courseId, updateScheduleDto);
  }

  @Delete()
  async deleteSchedule(
    @Param('courseId') courseId: string,
    @Request() req
  ) {
    // Verify user has permission to modify this course
    const course = await this.coursesService.findOne(courseId);
    const userId = req.user.id;
    
    const isTeacher = (course.teacher as any)._id.toString() === userId || 
                     course.teachers.some(t => t.toString() === userId);
    
    if (!isTeacher && req.user.role !== 'admin') {
      throw new BadRequestException('No tienes permisos para configurar el horario de este curso');
    }

    await this.courseScheduleService.deleteSchedule(courseId);
    return { message: 'Horario eliminado correctamente' };
  }
} 