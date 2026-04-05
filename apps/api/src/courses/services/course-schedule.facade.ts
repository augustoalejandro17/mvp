import { BadRequestException, Injectable } from '@nestjs/common';
import { CoursesService } from '../courses.service';
import { CourseScheduleService } from '../course-schedule.service';
import {
  CreateCourseScheduleDto,
  UpdateCourseScheduleDto,
} from '../dto/course-schedule.dto';

@Injectable()
export class CourseScheduleFacade {
  constructor(
    private readonly courseScheduleService: CourseScheduleService,
    private readonly coursesService: CoursesService,
  ) {}

  private getRequestUserId(user: any): string {
    return String(user.id || user.sub || user._id);
  }

  private async ensureCanModifySchedule(courseId: string, user: any) {
    const course = await this.coursesService.findOne(courseId);
    const userId = this.getRequestUserId(user);
    const teacherId =
      (course.teacher as any)?._id?.toString?.() ||
      (course.teacher as any)?.toString?.() ||
      '';
    const teacherIds = Array.isArray(course.teachers)
      ? course.teachers.map((teacher) => teacher?.toString?.() || String(teacher))
      : [];

    const isTeacher = teacherId === userId || teacherIds.includes(userId);
    if (!isTeacher && user.role !== 'admin') {
      throw new BadRequestException(
        'No tienes permisos para configurar el horario de este curso',
      );
    }
  }

  async createSchedule(
    courseId: string,
    createScheduleDto: CreateCourseScheduleDto,
    user: any,
  ) {
    await this.ensureCanModifySchedule(courseId, user);
    return this.courseScheduleService.createSchedule(courseId, createScheduleDto);
  }

  async updateSchedule(
    courseId: string,
    updateScheduleDto: UpdateCourseScheduleDto,
    user: any,
  ) {
    await this.ensureCanModifySchedule(courseId, user);
    return this.courseScheduleService.updateSchedule(courseId, updateScheduleDto);
  }

  async deleteSchedule(courseId: string, user: any) {
    await this.ensureCanModifySchedule(courseId, user);
    await this.courseScheduleService.deleteSchedule(courseId);
    return { message: 'Horario eliminado correctamente' };
  }

  getSchedule(courseId: string) {
    return this.courseScheduleService.getSchedule(courseId);
  }
}
