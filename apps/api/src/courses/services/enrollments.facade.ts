import { Injectable } from '@nestjs/common';
import { CoursesService } from '../courses.service';
import { UpdateEnrollmentDto } from '../dto/update-enrollment.dto';

@Injectable()
export class CourseEnrollmentsFacade {
  constructor(private readonly coursesService: CoursesService) {}

  private getUserContext(req: any) {
    return {
      userId: String(req.user.sub || req.user._id),
      userRole: req.user.role,
    };
  }

  findAll(req: any) {
    const { userId } = this.getUserContext(req);
    return this.coursesService.getAllEnrollments(userId);
  }

  findOne(id: string, req: any) {
    const { userId, userRole } = this.getUserContext(req);
    return this.coursesService.getEnrollmentById(id, userId, userRole);
  }

  update(id: string, updateEnrollmentDto: UpdateEnrollmentDto, req: any) {
    const { userId, userRole } = this.getUserContext(req);
    updateEnrollmentDto.updatedBy = userId;
    return this.coursesService.updateEnrollment(
      id,
      updateEnrollmentDto,
      userId,
      userRole,
    );
  }

  remove(id: string, req: any) {
    const { userId } = this.getUserContext(req);
    return this.coursesService.removeEnrollment(id, userId);
  }
}
