import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course } from '../../courses/schemas/course.schema';
import { Enrollment } from '../../courses/schemas/enrollment.schema';
import { RetentionRateDto } from '../dto/statistics.dto';

@Injectable()
export class RetentionService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
  ) {}

  /**
   * Calcula la tasa de retención por curso (estudiantes que continúan vs los que se inscribieron)
   * @returns Array con tasas de retención por curso
   */
  async getRetentionRatesByCourse(): Promise<RetentionRateDto[]> {
    const courses = await this.courseModel.find().exec();
    const retentionRates: RetentionRateDto[] = [];

    for (const course of courses) {
      // Obtener todas las inscripciones para este curso
      const enrollments = await this.enrollmentModel
        .find({ course: course._id })
        .exec();

      // Total de inscripciones (iniciales)
      const initialEnrollment = enrollments.length;

      // Inscripciones activas actualmente
      const currentEnrollment = enrollments.filter((e) => e.isActive).length;

      // Tasa de retención
      const retentionRate =
        initialEnrollment > 0
          ? Math.round((currentEnrollment / initialEnrollment) * 100)
          : 0;

      // La tasa de finalización se toma como un proxy, ya que no hay un campo específico
      // Asumimos que los que permanecen activos hasta el final "completaron" el curso
      // Esto debería refinarse en una implementación real con un campo específico
      const completedCount = currentEnrollment;
      const completionRate =
        initialEnrollment > 0
          ? Math.round((completedCount / initialEnrollment) * 100)
          : 0;

      retentionRates.push({
        courseId: course._id.toString(),
        courseName: course.title,
        initialEnrollment,
        currentEnrollment,
        retentionRate,
        completedCount,
        completionRate,
      });
    }

    return retentionRates;
  }

  /**
   * Calcula la tasa de retención para un curso específico
   * @param courseId ID del curso
   * @returns Datos de retención para el curso solicitado
   */
  async getRetentionRateForCourse(courseId: string): Promise<RetentionRateDto> {
    const course = await this.courseModel.findById(courseId).exec();

    if (!course) {
      throw new Error(`Course with ID ${courseId} not found`);
    }

    const enrollments = await this.enrollmentModel
      .find({ course: courseId })
      .exec();

    const initialEnrollment = enrollments.length;
    const currentEnrollment = enrollments.filter((e) => e.isActive).length;

    const retentionRate =
      initialEnrollment > 0
        ? Math.round((currentEnrollment / initialEnrollment) * 100)
        : 0;

    const completedCount = currentEnrollment;
    const completionRate =
      initialEnrollment > 0
        ? Math.round((completedCount / initialEnrollment) * 100)
        : 0;

    return {
      courseId: course._id.toString(),
      courseName: course.title,
      initialEnrollment,
      currentEnrollment,
      retentionRate,
      completedCount,
      completionRate,
    };
  }
}
