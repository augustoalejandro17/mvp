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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CourseScheduleFacade } from './services/course-schedule.facade';
import {
  CreateCourseScheduleDto,
  UpdateCourseScheduleDto,
} from './dto/course-schedule.dto';

@Controller('courses/:courseId/schedule')
@UseGuards(JwtAuthGuard)
export class CourseScheduleController {
  constructor(private readonly courseScheduleFacade: CourseScheduleFacade) {}

  @Post()
  async createSchedule(
    @Param('courseId') courseId: string,
    @Body() createScheduleDto: CreateCourseScheduleDto,
    @Request() req,
  ) {
    return this.courseScheduleFacade.createSchedule(
      courseId,
      createScheduleDto,
      req.user,
    );
  }

  @Get()
  async getSchedule(@Param('courseId') courseId: string) {
    return this.courseScheduleFacade.getSchedule(courseId);
  }

  @Put()
  async updateSchedule(
    @Param('courseId') courseId: string,
    @Body() updateScheduleDto: UpdateCourseScheduleDto,
    @Request() req,
  ) {
    return this.courseScheduleFacade.updateSchedule(
      courseId,
      updateScheduleDto,
      req.user,
    );
  }

  @Delete()
  async deleteSchedule(@Param('courseId') courseId: string, @Request() req) {
    return this.courseScheduleFacade.deleteSchedule(
      courseId,
      req.user,
    );
  }
}
