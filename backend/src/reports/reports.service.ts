import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance } from '../attendance/schemas/attendance.schema';
import { Course } from '../courses/schemas/course.schema';
import { School } from '../schools/schemas/school.schema';
import { User, UserRole } from '../auth/schemas/user.schema';
import {
  MonthlyReportParams,
  ExportReportParams,
  CourseAttendanceData,
  MonthlyAttendanceReport,
  ExportResult
} from './types/report.types';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async getMonthlyAttendanceReport(params: MonthlyReportParams): Promise<MonthlyAttendanceReport> {
    const { userId, userRole, schoolId, month, year, courseId } = params;

    this.logger.log(`Generating monthly attendance report for ${userRole} user ${userId}`);

    // 1. Determine which schools the user can access
    const accessibleSchoolIds = await this.getAccessibleSchools(userId, userRole, schoolId);
    
    if (accessibleSchoolIds.length === 0) {
      throw new BadRequestException('No accessible schools found for this user');
    }

    // For now, use the first school if no specific schoolId provided
    const targetSchoolId = schoolId || accessibleSchoolIds[0];
    const school = await this.schoolModel.findById(targetSchoolId);
    
    if (!school) {
      throw new BadRequestException('School not found');
    }

    // 2. Get courses for the school (optionally filtered by courseId)
    let courseFilter: any = { school: targetSchoolId };
    if (courseId) {
      courseFilter._id = courseId;
    }

    const courses = await this.courseModel.find(courseFilter);
    
    if (courses.length === 0) {
      // Return empty report if no courses found
      return this.createEmptyReport(school, month, year);
    }

    // 3. Create date range for the month
    const startDate = new Date(year, month - 1, 1); // Month is 0-indexed in Date
    const endDate = new Date(year, month, 0, 23, 59, 59); // Last day of month

    this.logger.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // 4. Get attendance data for all courses in the date range
    const courseAttendanceData = await Promise.all(
      courses.map(course => this.getCourseAttendanceData(course, startDate, endDate))
    );

    // 5. Calculate summary statistics
    const summary = this.calculateSummary(courseAttendanceData);

    // 6. Build the report
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const report: MonthlyAttendanceReport = {
      school: {
        id: school._id.toString(),
        name: school.name
      },
      period: {
        month,
        year,
        monthName: monthNames[month - 1]
      },
      summary,
      courseDetails: courseAttendanceData
    };

    this.logger.log(`Generated report for ${courses.length} courses with ${summary.totalClasses} total classes`);
    return report;
  }

  private async getAccessibleSchools(userId: string, userRole: string, schoolId?: string): Promise<string[]> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    let accessibleSchoolIds: string[] = [];

    switch (userRole.toLowerCase()) {
      case 'super_admin':
        if (schoolId) {
          accessibleSchoolIds = [schoolId];
        } else {
          const allSchools = await this.schoolModel.find({}, '_id');
          accessibleSchoolIds = allSchools.map(s => s._id.toString());
        }
        break;

      case 'school_owner':
        const ownedSchools = await this.schoolModel.find({ admin: userId });
        const userOwnedSchools = user.ownedSchools || [];
        accessibleSchoolIds = [
          ...ownedSchools.map(s => s._id.toString()),
          ...userOwnedSchools.map(id => id.toString())
        ];
        // Remove duplicates
        accessibleSchoolIds = [...new Set(accessibleSchoolIds)];
        break;

      case 'administrative':
        const administratedSchools = await this.schoolModel.find({ administratives: userId });
        const userAdministratedSchools = user.administratedSchools || [];
        accessibleSchoolIds = [
          ...administratedSchools.map(s => s._id.toString()),
          ...userAdministratedSchools.map(id => id.toString())
        ];
        // Remove duplicates
        accessibleSchoolIds = [...new Set(accessibleSchoolIds)];
        break;

      default:
        throw new BadRequestException('User role not authorized for reports');
    }

    // If a specific schoolId was requested, make sure user has access to it
    if (schoolId && !accessibleSchoolIds.includes(schoolId)) {
      throw new BadRequestException('User does not have access to the requested school');
    }

    return accessibleSchoolIds;
  }

  private async getCourseAttendanceData(
    course: any, 
    startDate: Date, 
    endDate: Date
  ): Promise<CourseAttendanceData> {
    
    // Get all attendance records for this course in the date range
    const attendanceRecords = await this.attendanceModel.find({
      course: course._id,
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate unique classes (by date)
    const uniqueDates = [...new Set(attendanceRecords.map(record => 
      record.date.toDateString()
    ))];
    const totalClasses = uniqueDates.length;

    // Calculate unique students
    const uniqueStudents = [...new Set(attendanceRecords.map(record => 
      record.student.toString()
    ))];
    const totalStudents = uniqueStudents.length;

    // Calculate attendance statistics
    const presentCount = attendanceRecords.filter(record => record.present).length;
    const absentCount = attendanceRecords.length - presentCount;
    
    const attendancePercentage = attendanceRecords.length > 0 
      ? Math.round((presentCount / attendanceRecords.length) * 100) 
      : 0;

    return {
      courseId: course._id.toString(),
      courseName: course.title,
      totalClasses,
      totalStudents,
      attendancePercentage,
      presentCount,
      absentCount
    };
  }

  private calculateSummary(courseData: CourseAttendanceData[]) {
    const totalCourses = courseData.length;
    const totalClasses = courseData.reduce((sum, course) => sum + course.totalClasses, 0);
    // Sum all students across courses (total enrollments)
    const totalStudents = courseData.reduce((sum, course) => sum + course.totalStudents, 0);
    
    const totalPresent = courseData.reduce((sum, course) => sum + course.presentCount, 0);
    const totalRecords = courseData.reduce((sum, course) => sum + course.presentCount + course.absentCount, 0);
    
    const overallAttendancePercentage = totalRecords > 0 
      ? Math.round((totalPresent / totalRecords) * 100) 
      : 0;

    return {
      totalCourses,
      totalClasses,
      totalStudents,
      overallAttendancePercentage
    };
  }

  private createEmptyReport(school: any, month: number, year: number): MonthlyAttendanceReport {
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    return {
      school: {
        id: school._id.toString(),
        name: school.name
      },
      period: {
        month,
        year,
        monthName: monthNames[month - 1]
      },
      summary: {
        totalCourses: 0,
        totalClasses: 0,
        totalStudents: 0,
        overallAttendancePercentage: 0
      },
      courseDetails: []
    };
  }

  async exportMonthlyAttendanceReport(params: ExportReportParams): Promise<any> {
    const report = await this.getMonthlyAttendanceReport(params);
    
    if (params.format === 'csv') {
      return this.generateCSV(report);
    } else if (params.format === 'excel') {
      // TODO: Implement Excel export
      throw new BadRequestException('Excel export not yet implemented');
    }
    
    throw new BadRequestException('Invalid export format');
  }

  private generateCSV(report: MonthlyAttendanceReport): ExportResult {
    const headers = [
      'Curso',
      'Total Clases',
      'Total Estudiantes', 
      'Asistencias',
      'Faltas',
      'Porcentaje Asistencia'
    ];

    const rows = report.courseDetails.map(course => [
      course.courseName,
      course.totalClasses.toString(),
      course.totalStudents.toString(),
      course.presentCount.toString(),
      course.absentCount.toString(),
      `${course.attendancePercentage}%`
    ]);

    const csvContent = [
      `Reporte de Asistencia - ${report.school.name}`,
      `Período: ${report.period.monthName} ${report.period.year}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(',')),
      '',
      `Resumen General:`,
      `Total Cursos,${report.summary.totalCourses}`,
      `Total Clases,${report.summary.totalClasses}`,
      `Total Estudiantes,${report.summary.totalStudents}`,
      `Porcentaje General,${report.summary.overallAttendancePercentage}%`
    ].join('\n');

    const filename = `asistencia_${report.school.name.toLowerCase().replace(/\s+/g, '_')}_${report.period.year}_${report.period.month.toString().padStart(2, '0')}.csv`;

    return {
      data: csvContent,
      filename
    };
  }
} 