import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course } from '../../courses/schemas/course.schema';
import { Enrollment } from '../../courses/schemas/enrollment.schema';
import { DropoutRateDto } from '../dto/statistics.dto';

@Injectable()
export class DropoutService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
  ) {}

  /**
   * Calcula las tasas de abandono por curso y los puntos cru00edticos donde ocurren
   * @returns Array con tasas de abandono por curso
   */
  async getDropoutRatesByCourse(): Promise<DropoutRateDto[]> {
    const courses = await this.courseModel.find().exec();
    const dropoutRates: DropoutRateDto[] = [];

    for (const course of courses) {
      const courseId = course._id;

      // Obtener todas las inscripciones para este curso
      const enrollments = await this.enrollmentModel
        .find({
          course: courseId,
        })
        .exec();

      const totalEnrollments = enrollments.length;

      if (totalEnrollments === 0) {
        continue; // Saltar cursos sin inscripciones
      }

      // Inscripciones inactivas (abandonos)
      const dropoutEnrollments = enrollments.filter((e) => !e.isActive);
      const dropoutCount = dropoutEnrollments.length;

      // Tasa de abandono
      const dropoutRate = Math.round((dropoutCount / totalEnrollments) * 100);

      // Analizar puntos cru00edticos de abandono
      // Para esto necesitaru00edamos conocer cuu00e1ndo se marcu00f3 como inactivo (droppedAt)
      // Como no tenemos ese campo explu00edcito, podru00edamos inferirlo de la fecha de u00faltima actualizaciu00f3n
      // Pero seru00eda mu00e1s preciso tener un campo explu00edcito

      // Aquu00ed simulamos algunos puntos cru00edticos basados en datos ficticios
      // En una implementaciu00f3n real, esto vendru00eda de datos reales
      const criticalPoints = [
        { timePoint: 7, dropoutCount: Math.round(dropoutCount * 0.2) }, // 1 semana
        { timePoint: 30, dropoutCount: Math.round(dropoutCount * 0.5) }, // 1 mes
        { timePoint: 60, dropoutCount: Math.round(dropoutCount * 0.3) }, // 2 meses
      ];

      dropoutRates.push({
        courseId: courseId.toString(),
        courseName: course.title,
        dropoutRate,
        dropoutCount,
        criticalPoints,
      });
    }

    // Ordenar por la tasa de abandono mu00e1s alta
    return dropoutRates.sort((a, b) => b.dropoutRate - a.dropoutRate);
  }

  /**
   * Calcula la tasa de abandono global de la academia
   * @returns Tasa de abandono global como porcentaje
   */
  async getOverallDropoutRate(): Promise<number> {
    // Obtener todas las inscripciones
    const allEnrollments = await this.enrollmentModel.find().exec();
    const totalEnrollments = allEnrollments.length;

    if (totalEnrollments === 0) {
      return 0;
    }

    // Contar abandonos (inscripciones inactivas)
    const dropouts = allEnrollments.filter((e) => !e.isActive).length;

    // Calcular tasa global de abandono
    return Math.round((dropouts / totalEnrollments) * 100);
  }

  /**
   * Obtiene informaciu00f3n detallada sobre abandonos para un curso especu00edfico
   * @param courseId ID del curso
   * @returns Datos detallados de abandono para el curso
   */
  async getCourseDropoutDetails(courseId: string): Promise<DropoutRateDto> {
    const course = await this.courseModel.findById(courseId).exec();

    if (!course) {
      throw new Error(`Course with ID ${courseId} not found`);
    }

    // Obtener todas las inscripciones para este curso
    const enrollments = await this.enrollmentModel
      .find({
        course: courseId,
      })
      .exec();

    const totalEnrollments = enrollments.length;

    if (totalEnrollments === 0) {
      return {
        courseId: courseId.toString(),
        courseName: course.title,
        dropoutRate: 0,
        dropoutCount: 0,
        criticalPoints: [],
      };
    }

    // Inscripciones inactivas (abandonos)
    const dropoutEnrollments = enrollments.filter((e) => !e.isActive);
    const dropoutCount = dropoutEnrollments.length;

    // Tasa de abandono
    const dropoutRate = Math.round((dropoutCount / totalEnrollments) * 100);

    // Anu00e1lisis de puntos cru00edticos (simulados)
    // En una implementaciu00f3n real, se analizaru00eda droppedAt
    const criticalPoints = [
      { timePoint: 7, dropoutCount: Math.round(dropoutCount * 0.2) },
      { timePoint: 30, dropoutCount: Math.round(dropoutCount * 0.5) },
      { timePoint: 60, dropoutCount: Math.round(dropoutCount * 0.3) },
    ];

    return {
      courseId: courseId.toString(),
      courseName: course.title,
      dropoutRate,
      dropoutCount,
      criticalPoints,
    };
  }
}
