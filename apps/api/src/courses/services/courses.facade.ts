import { Injectable, UnauthorizedException } from '@nestjs/common';
import { CreateCourseDto } from '../dto/create-course.dto';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { CoursesService } from '../courses.service';
import {
  getUserIdFromRequest,
  getUserRoleFromRequest,
} from '../../utils/token-handler';
import { UserRole } from '../../auth/enums/user-role.enum';

type ServiceUserRole = any;

@Injectable()
export class CoursesFacade {
  constructor(private readonly coursesService: CoursesService) {}

  async getSeatPolicy(req: any, query: {
    schoolId?: string;
    courseId?: string;
    ownerId?: string;
  }) {
    const userId = getUserIdFromRequest(req);
    return this.coursesService.getSeatPolicyForUser(userId, query);
  }

  async findAll(req: any, schoolId?: string) {
    let userId = null;
    let userRole = null;

    if (req.user) {
      userId = getUserIdFromRequest(req);
      userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;
    }

    return this.coursesService.findAll(userId, userRole, schoolId);
  }

  async getTeachingCourses(req: any) {
    const userId = getUserIdFromRequest(req);
    const userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;
    return this.coursesService.getTeachingCourses(userId, userRole);
  }

  async getEnrolledCourses(req: any, targetUserId?: string) {
    const userId = getUserIdFromRequest(req);
    const userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;

    if (targetUserId && targetUserId !== userId) {
      const isAllowed =
        userRole === UserRole.SUPER_ADMIN ||
        userRole === UserRole.ADMIN ||
        userRole === UserRole.SCHOOL_OWNER ||
        userRole === UserRole.TEACHER;

      if (!isAllowed) {
        throw new UnauthorizedException(
          'No tienes permiso para ver los cursos de otros usuarios',
        );
      }

      return this.coursesService.getEnrolledCourses(targetUserId);
    }

    return this.coursesService.getEnrolledCourses(userId);
  }

  async getPublicEnrolledCourses(userId: string) {
    try {
      return await this.coursesService.getEnrolledCourses(userId);
    } catch {
      return [];
    }
  }

  async getPublicTeachingCourses(userId: string) {
    try {
      const courses = await this.coursesService.findAll(userId, 'teacher');
      return courses.filter((course) => {
        const isMainTeacher =
          course.teacher &&
          ((course.teacher as any)._id
            ? (course.teacher as any)._id.toString() === userId
            : course.teacher.toString() === userId);

        const isInTeachers =
          course.teachers &&
          course.teachers.some((teacher) =>
            (teacher as any)._id
              ? (teacher as any)._id.toString() === userId
              : teacher.toString() === userId,
          );

        return isMainTeacher || isInTeachers;
      });
    } catch {
      return [];
    }
  }

  async findOne(req: any, id: string, includeSchedule?: string) {
    const userId = req.user?.sub;
    const userRole = req.user?.role;
    const shouldIncludeSchedule = includeSchedule === 'true';

    return this.coursesService.getCourseForUser(
      id,
      userId,
      userRole,
      shouldIncludeSchedule,
    );
  }

  async create(req: any, createCourseDto: CreateCourseDto) {
    const userId = getUserIdFromRequest(req);

    if (!createCourseDto.teacher) {
      createCourseDto.teacher = userId;
    }

    return this.coursesService.create(createCourseDto, userId);
  }

  async update(req: any, id: string, updateCourseDto: UpdateCourseDto) {
    const userId = getUserIdFromRequest(req);
    return this.coursesService.update(id, updateCourseDto, userId);
  }

  async addStudent(req: any, id: string, studentId: string) {
    const userId = getUserIdFromRequest(req);
    return this.coursesService.addStudent(id, studentId, userId);
  }

  async enrollStudent(req: any, id: string, studentId: string) {
    const userId = getUserIdFromRequest(req);
    return this.coursesService.enrollStudent(id, studentId, userId);
  }

  async unenrollStudent(req: any, id: string, studentId: string) {
    const userId = getUserIdFromRequest(req);
    await this.coursesService.unenrollStudent(id, studentId, userId);
    return { success: true };
  }

  async removeStudent(req: any, id: string, studentId: string) {
    const userId = getUserIdFromRequest(req);
    return this.coursesService.removeStudent(id, studentId, userId);
  }

  async remove(req: any, id: string) {
    const userId = getUserIdFromRequest(req);
    const userRole = getUserRoleFromRequest(req) as unknown as ServiceUserRole;
    return this.coursesService.remove(id, userId, userRole);
  }
}
