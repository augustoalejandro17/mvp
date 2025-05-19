import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course } from '../../courses/schemas/course.schema';
import { Enrollment } from '../../courses/schemas/enrollment.schema';
import { Attendance } from '../../attendance/schemas/attendance.schema';
import { User } from '../../auth/schemas/user.schema';
import { TeacherPerformanceDto } from '../dto/statistics.dto';

@Injectable()
export class PerformanceService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(User.name) private userModel: Model<User>
  ) {}

  /**
   * Obtiene mu00e9tricas de rendimiento para todos los profesores
   * @returns Array con mu00e9tricas de rendimiento de profesores
   */
  async getTeachersPerformance(): Promise<TeacherPerformanceDto[]> {
    // Obtener todos los profesores
    const teachers = await this.userModel.find({ role: 'teacher' }).exec();
    const performanceMetrics: TeacherPerformanceDto[] = [];
    
    for (const teacher of teachers) {
      const teacherId = teacher._id.toString();
      
      // Cursos que imparte el profesor
      const courses = await this.courseModel.find({ teacher: teacher._id }).exec();
      const coursesIds = courses.map(course => course._id);
      
      // Total de estudiantes en sus cursos
      const studentsCount = await this.enrollmentModel.countDocuments({
        course: { $in: coursesIds },
        isActive: true
      }).exec();
      
      // Promedios de asistencia
      const attendanceRecords = await this.attendanceModel.find({
        course: { $in: coursesIds }
      }).exec();
      
      const avgAttendanceRate = attendanceRecords.length > 0
        ? Math.round(attendanceRecords.reduce((sum, record) => {
            return sum + (record.studentsPresent / record.totalStudents * 100);
          }, 0) / attendanceRecords.length)
        : 0;
      
      // Retención promedio de sus cursos
      let avgRetentionRate = 0;
      let totalEnrollments = 0;
      let activeEnrollments = 0;
      
      for (const courseId of coursesIds) {
        const enrollments = await this.enrollmentModel.find({ course: courseId }).exec();
        totalEnrollments += enrollments.length;
        activeEnrollments += enrollments.filter(e => e.isActive).length;
      }
      
      if (totalEnrollments > 0) {
        avgRetentionRate = Math.round((activeEnrollments / totalEnrollments) * 100);
      }
      
      // Satisfacciu00f3n (simulada para este ejemplo, en una implementaciu00f3n real podru00eda
      // venir de encuestas a estudiantes)
      const satisfaction = Math.round(70 + Math.random() * 25); // 70-95% de satisfacciu00f3n
      
      // Generar tendencia mensual (simulada)
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
      const monthlyTrend = months.map(month => ({
        month,
        retention: Math.max(60, Math.min(100, avgRetentionRate + (Math.random() * 10 - 5))),
        attendance: Math.max(60, Math.min(100, avgAttendanceRate + (Math.random() * 10 - 5)))
      }));
      
      performanceMetrics.push({
        teacherId,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        avgRetentionRate,
        avgAttendanceRate,
        coursesCount: courses.length,
        studentsCount,
        satisfaction,
        monthlyTrend
      });
    }
    
    return performanceMetrics;
  }

  /**
   * Obtiene mu00e9tricas de rendimiento para un profesor especu00edfico
   * @param teacherId ID del profesor
   * @returns Mu00e9tricas de rendimiento para el profesor
   */
  async getTeacherPerformance(teacherId: string): Promise<TeacherPerformanceDto> {
    const teacher = await this.userModel.findById(teacherId).exec();
    
    if (!teacher) {
      throw new Error(`Teacher with ID ${teacherId} not found`);
    }
    
    // Cursos que imparte el profesor
    const courses = await this.courseModel.find({ teacher: teacher._id }).exec();
    const coursesIds = courses.map(course => course._id);
    
    // Total de estudiantes en sus cursos
    const studentsCount = await this.enrollmentModel.countDocuments({
      course: { $in: coursesIds },
      isActive: true
    }).exec();
    
    // Promedios de asistencia
    const attendanceRecords = await this.attendanceModel.find({
      course: { $in: coursesIds }
    }).exec();
    
    const avgAttendanceRate = attendanceRecords.length > 0
      ? Math.round(attendanceRecords.reduce((sum, record) => {
          return sum + (record.studentsPresent / record.totalStudents * 100);
        }, 0) / attendanceRecords.length)
      : 0;
    
    // Retenciu00f3n promedio de sus cursos
    let avgRetentionRate = 0;
    let totalEnrollments = 0;
    let activeEnrollments = 0;
    
    for (const courseId of coursesIds) {
      const enrollments = await this.enrollmentModel.find({ course: courseId }).exec();
      totalEnrollments += enrollments.length;
      activeEnrollments += enrollments.filter(e => e.isActive).length;
    }
    
    if (totalEnrollments > 0) {
      avgRetentionRate = Math.round((activeEnrollments / totalEnrollments) * 100);
    }
    
    // Satisfacciu00f3n (simulada para este ejemplo)
    const satisfaction = Math.round(70 + Math.random() * 25); // 70-95% de satisfacciu00f3n
    
    // Generar tendencia mensual (simulada)
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    const monthlyTrend = months.map(month => ({
      month,
      retention: Math.max(60, Math.min(100, avgRetentionRate + (Math.random() * 10 - 5))),
      attendance: Math.max(60, Math.min(100, avgAttendanceRate + (Math.random() * 10 - 5)))
    }));
    
    return {
      teacherId,
      teacherName: `${teacher.firstName} ${teacher.lastName}`,
      avgRetentionRate,
      avgAttendanceRate,
      coursesCount: courses.length,
      studentsCount,
      satisfaction,
      monthlyTrend
    };
  }
} 