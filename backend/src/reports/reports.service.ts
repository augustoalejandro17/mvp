import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as XLSX from 'xlsx';
import { Attendance } from '../attendance/schemas/attendance.schema';
import { Course } from '../courses/schemas/course.schema';
import { School } from '../schools/schemas/school.schema';
import { User, UserRole } from '../auth/schemas/user.schema';
import { Enrollment } from '../courses/schemas/enrollment.schema';
import {
  MonthlyReportParams,
  ExportReportParams,
  CourseAttendanceData,
  MonthlyAttendanceReport,
  DetailedMonthlyAttendanceReport,
  DetailedCourseAttendanceData,
  StudentAttendanceDetail,
  ExportResult,
  CoursePaymentData,
  MonthlyPaymentReport,
  DetailedMonthlyPaymentReport,
  DetailedCoursePaymentData,
  StudentPaymentDetail
} from './types/report.types';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
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

  async exportMonthlyAttendanceReport(params: ExportReportParams): Promise<ExportResult> {
    if (params.format === 'csv') {
      const report = await this.getMonthlyAttendanceReport(params);
      return this.generateCSV(report);
    } else if (params.format === 'excel') {
      const detailedReport = await this.getDetailedMonthlyAttendanceReport(params);
      return this.generateExcel(detailedReport);
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
      filename,
      contentType: 'text/csv'
    };
  }

  async getDetailedMonthlyAttendanceReport(params: MonthlyReportParams): Promise<DetailedMonthlyAttendanceReport> {
    const basicReport = await this.getMonthlyAttendanceReport(params);
    
    // Get detailed data for each course
    const detailedCourseData = await Promise.all(
      basicReport.courseDetails.map(async (courseData) => {
        const course = await this.courseModel.findById(courseData.courseId);
        if (!course) {
          throw new BadRequestException(`Course not found: ${courseData.courseId}`);
        }
        
        const startDate = new Date(basicReport.period.year, basicReport.period.month - 1, 1);
        const endDate = new Date(basicReport.period.year, basicReport.period.month, 0, 23, 59, 59);
        
        return this.getDetailedCourseAttendanceData(course, startDate, endDate);
      })
    );

    return {
      ...basicReport,
      detailedCourseData
    };
  }

  private async getDetailedCourseAttendanceData(
    course: any, 
    startDate: Date, 
    endDate: Date
  ): Promise<DetailedCourseAttendanceData> {
    // Get basic course data
    const basicData = await this.getCourseAttendanceData(course, startDate, endDate);
    
    // Get school timezone information
    const school = await this.schoolModel.findById(course.school);
    const schoolTimezone = school?.timezone || 'America/Bogota'; // Default to GMT-5
    
    // Calculate timezone offset in minutes (for America/Bogota it's +300 minutes from UTC)
    const timezoneOffset = this.getTimezoneOffset(schoolTimezone);
    
    // Get all attendance records for this course in the date range
    const attendanceRecords = await this.attendanceModel.find({
      course: course._id,
      date: { $gte: startDate, $lte: endDate }
    }).populate('student', 'name email');

    // Get unique class dates (convert UTC stored dates back to school's local time)
    const classDates = [...new Set(attendanceRecords.map(record => {
      // Convert UTC stored date back to school's local time
      const localDate = new Date(record.date.getTime() - timezoneOffset * 60000);
      return localDate.toISOString().split('T')[0];
    }))].sort();

    // Group by student
    const studentAttendanceMap = new Map<string, any>();
    
    attendanceRecords.forEach(record => {
      const studentData = record.student as any;
      const studentId = studentData._id ? studentData._id.toString() : studentData.toString();
      
      if (!studentAttendanceMap.has(studentId)) {
        studentAttendanceMap.set(studentId, {
          studentId,
          studentName: studentData.name || 'N/A',
          studentEmail: studentData.email || 'N/A',
          attendanceRecords: [],
          totalPresent: 0,
          totalAbsent: 0
        });
      }
      
      const studentAttendance = studentAttendanceMap.get(studentId);
      // Convert UTC stored date back to school's local time
      const localDate = new Date(record.date.getTime() - timezoneOffset * 60000);
      const formattedDate = localDate.toISOString().split('T')[0];
      
      studentAttendance.attendanceRecords.push({
        date: formattedDate,
        present: record.present,
        classTitle: (record as any).classTitle || 'Clase'
      });
      
      if (record.present) {
        studentAttendance.totalPresent++;
      } else {
        studentAttendance.totalAbsent++;
      }
    });

    // Calculate attendance percentage for each student
    const studentDetails: StudentAttendanceDetail[] = Array.from(studentAttendanceMap.values()).map(student => {
      const totalRecords = student.totalPresent + student.totalAbsent;
      const attendancePercentage = totalRecords > 0 ? Math.round((student.totalPresent / totalRecords) * 100) : 0;
      
      return {
        ...student,
        attendancePercentage
      };
    });

    return {
      ...basicData,
      studentDetails,
      classDates
    };
  }

  private generateExcel(report: DetailedMonthlyAttendanceReport): ExportResult {
    const workbook = XLSX.utils.book_new();
    
    // Create summary sheet
    this.createSummarySheet(workbook, report);
    
    // Create detailed sheets for each course
    report.detailedCourseData.forEach(courseData => {
      this.createCourseDetailSheet(workbook, courseData, report.period);
    });

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    
    const filename = `asistencia_detallada_${report.school.name.toLowerCase().replace(/\s+/g, '_')}_${report.period.year}_${report.period.month.toString().padStart(2, '0')}.xlsx`;

    return {
      data: excelBuffer,
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  private createSummarySheet(workbook: XLSX.WorkBook, report: DetailedMonthlyAttendanceReport): void {
    const summaryData = [
      [`Reporte de Asistencia - ${report.school.name}`],
      [`Período: ${report.period.monthName} ${report.period.year}`],
      [],
      ['Curso', 'Total Clases', 'Total Estudiantes', 'Asistencias', 'Faltas', 'Porcentaje Asistencia'],
      ...report.courseDetails.map(course => [
        course.courseName,
        course.totalClasses,
        course.totalStudents,
        course.presentCount,
        course.absentCount,
        `${course.attendancePercentage}%`
      ]),
      [],
      ['Resumen General:'],
      ['Total Cursos', report.summary.totalCourses],
      ['Total Clases', report.summary.totalClasses],
      ['Total Estudiantes', report.summary.totalStudents],
      ['Porcentaje General', `${report.summary.overallAttendancePercentage}%`]
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen');
  }

  private createCourseDetailSheet(workbook: XLSX.WorkBook, courseData: DetailedCourseAttendanceData, period: any): void {
    const sheetName = courseData.courseName.substring(0, 31); // Excel sheet name limit
    
    // Create headers
    const headers = ['Estudiante', 'Email', 'Total Presente', 'Total Ausente', 'Porcentaje', ...courseData.classDates];
    
    // Create student rows
    const studentRows = courseData.studentDetails.map(student => {
      const row = [
        student.studentName,
        student.studentEmail,
        student.totalPresent,
        student.totalAbsent,
        `${student.attendancePercentage}%`
      ];
      
      // Add attendance for each class date
      courseData.classDates.forEach(date => {
        const attendanceRecord = student.attendanceRecords.find(record => record.date === date);
        row.push(attendanceRecord ? (attendanceRecord.present ? 'Presente' : 'Ausente') : 'N/A');
      });
      
      return row;
    });

    const sheetData = [
      [`${courseData.courseName} - ${period.monthName} ${period.year}`],
      [],
      headers,
      ...studentRows
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  private getTimezoneOffset(timezone: string): number {
    // Helper method to get timezone offset in minutes
    // For common timezones used in the application
    const timezoneOffsets: { [key: string]: number } = {
      'America/Bogota': 5 * 60,        // GMT-5 (Colombia)
      'America/New_York': 5 * 60,      // GMT-5 (EST) / GMT-4 (EDT) - using standard time
      'America/Los_Angeles': 8 * 60,   // GMT-8 (PST) / GMT-7 (PDT) - using standard time
      'UTC': 0,                        // GMT+0
      'Europe/Madrid': -1 * 60,        // GMT+1 (CET) / GMT+2 (CEST) - using standard time
    };

    return timezoneOffsets[timezone] || 5 * 60; // Default to GMT-5 if timezone not found
  }

  // Payment Reports Methods
  async getMonthlyPaymentReport(params: MonthlyReportParams): Promise<MonthlyPaymentReport> {
    const { userId, userRole, schoolId, month, year, courseId } = params;

    this.logger.log(`Generating monthly payment report for ${userRole} user ${userId}`);

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
      return this.createEmptyPaymentReport(school, month, year);
    }

    // 3. Get payment data for all courses
    const coursePaymentData = await Promise.all(
      courses.map(course => this.getCoursePaymentData(course, month, year))
    );

    // 4. Calculate summary statistics
    const summary = this.calculatePaymentSummary(coursePaymentData);

    // 5. Build the report
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const report: MonthlyPaymentReport = {
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
      courseDetails: coursePaymentData
    };

    this.logger.log(`Generated payment report for ${courses.length} courses with total revenue: ${summary.totalRevenue}`);
    return report;
  }

  private async getCoursePaymentData(course: any, month: number, year: number): Promise<CoursePaymentData> {
    // Get all enrollments for this course
    const enrollments = await this.enrollmentModel.find({
      course: course._id,
      isActive: true
    }).populate('student', 'name email');

    const totalStudents = enrollments.length;

    // Filter payments for the specific month/year
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;
    
    let totalRevenue = 0;
    let studentsWithPayments = 0;
    
    enrollments.forEach(enrollment => {
      const monthPayments = enrollment.paymentHistory.filter(payment => payment.month === targetMonth);
      
      if (monthPayments.length > 0) {
        studentsWithPayments++;
        totalRevenue += monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
      }
    });

    const studentsWithoutPayments = totalStudents - studentsWithPayments;
    const paymentPercentage = totalStudents > 0 ? Math.round((studentsWithPayments / totalStudents) * 100) : 0;

    return {
      courseId: course._id.toString(),
      courseName: course.title,
      totalStudents,
      studentsWithPayments,
      studentsWithoutPayments,
      totalRevenue,
      paymentPercentage
    };
  }

  private calculatePaymentSummary(courseData: CoursePaymentData[]) {
    const totalCourses = courseData.length;
    const totalStudents = courseData.reduce((sum, course) => sum + course.totalStudents, 0);
    const totalRevenue = courseData.reduce((sum, course) => sum + course.totalRevenue, 0);
    const totalStudentsWithPayments = courseData.reduce((sum, course) => sum + course.studentsWithPayments, 0);
    
    const overallPaymentPercentage = totalStudents > 0 
      ? Math.round((totalStudentsWithPayments / totalStudents) * 100) 
      : 0;

    return {
      totalCourses,
      totalStudents,
      totalRevenue,
      overallPaymentPercentage
    };
  }

  private createEmptyPaymentReport(school: any, month: number, year: number): MonthlyPaymentReport {
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
        totalStudents: 0,
        totalRevenue: 0,
        overallPaymentPercentage: 0
      },
      courseDetails: []
    };
  }

  async getDetailedMonthlyPaymentReport(params: MonthlyReportParams): Promise<DetailedMonthlyPaymentReport> {
    const basicReport = await this.getMonthlyPaymentReport(params);
    
    // Get detailed data for each course
    const detailedCourseData = await Promise.all(
      basicReport.courseDetails.map(async (courseData) => {
        const course = await this.courseModel.findById(courseData.courseId);
        if (!course) {
          throw new BadRequestException(`Course not found: ${courseData.courseId}`);
        }
        
        return this.getDetailedCoursePaymentData(course, basicReport.period.month, basicReport.period.year);
      })
    );

    return {
      ...basicReport,
      detailedCourseData
    };
  }

  private async getDetailedCoursePaymentData(
    course: any,
    month: number,
    year: number
  ): Promise<DetailedCoursePaymentData> {
    // Get basic course data
    const basicData = await this.getCoursePaymentData(course, month, year);
    
    // Get all enrollments for this course
    const enrollments = await this.enrollmentModel.find({
      course: course._id
    }).populate('student', 'name email');

    // Get the target month format for filtering payments
    const targetMonth = `${year}-${month.toString().padStart(2, '0')}`;
    
    // Build student payment details
    const studentDetails: StudentPaymentDetail[] = enrollments.map(enrollment => {
      const studentData = enrollment.student as any;
      
      // Filter payments for the target month
      const monthPayments = enrollment.paymentHistory?.filter(payment => 
        payment.month === targetMonth
      ) || [];
      
      // Calculate total payment amount for the month
      const totalPaid = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
      const hasPayments = monthPayments.length > 0;
      
      return {
        studentId: studentData._id.toString(),
        studentName: studentData.name || 'N/A',
        studentEmail: studentData.email || 'N/A',
        paymentRecords: monthPayments.map(payment => ({
          date: payment.date.toISOString().split('T')[0],
          amount: payment.amount,
          description: payment.notes || 'Pago mensual'
        })),
        totalPaid,
        hasPayments
      };
    });

    return {
      ...basicData,
      studentDetails
    };
  }

  async exportMonthlyPaymentReport(params: ExportReportParams): Promise<ExportResult> {
    const detailedReport = await this.getDetailedMonthlyPaymentReport(params);
    
    if (params.format === 'excel') {
      return this.generatePaymentExcel(detailedReport);
    } else {
      return this.generatePaymentCSV(detailedReport);
    }
  }

  private generatePaymentCSV(report: DetailedMonthlyPaymentReport): ExportResult {
    const { school, period, summary, courseDetails } = report;
    
    let csvContent = '';
    
    // Header
    csvContent += `Reporte de Pagos Mensual\n`;
    csvContent += `Escuela: ${school.name}\n`;
    csvContent += `Período: ${period.monthName} ${period.year}\n\n`;
    
    // Summary
    csvContent += `Resumen General\n`;
    csvContent += `Total de Cursos,${summary.totalCourses}\n`;
    csvContent += `Total de Estudiantes,${summary.totalStudents}\n`;
    csvContent += `Ingresos Totales,${summary.totalRevenue.toFixed(2)}\n`;
    csvContent += `Porcentaje de Pago,${summary.overallPaymentPercentage}%\n\n`;
    
    // Course details
    csvContent += `Detalle por Curso\n`;
    csvContent += `Curso,Estudiantes,Con Pagos,Sin Pagos,Ingresos,% Pago\n`;
    
    courseDetails.forEach(course => {
      csvContent += `"${course.courseName}",${course.totalStudents},${course.studentsWithPayments},${course.studentsWithoutPayments},${course.totalRevenue.toFixed(2)},${course.paymentPercentage}%\n`;
    });
    
    const filename = `reporte-pagos-${school.name.replace(/\s+/g, '-')}-${period.year}-${String(period.month).padStart(2, '0')}.csv`;
    
    return {
      data: csvContent,
      filename,
      contentType: 'text/csv; charset=utf-8'
    };
  }

  private generatePaymentExcel(report: DetailedMonthlyPaymentReport): ExportResult {
    const workbook = XLSX.utils.book_new();
    
    // Create summary sheet
    this.createPaymentSummarySheet(workbook, report);
    
    // Create detailed sheets for each course
    report.detailedCourseData.forEach(courseData => {
      this.createCoursePaymentDetailSheet(workbook, courseData, report.period);
    });
    
    const filename = `reporte-pagos-detallado-${report.school.name.replace(/\s+/g, '-')}-${report.period.year}-${String(report.period.month).padStart(2, '0')}.xlsx`;
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return {
      data: buffer,
      filename,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
  }

  private createPaymentSummarySheet(workbook: XLSX.WorkBook, report: DetailedMonthlyPaymentReport): void {
    const { school, period, summary, courseDetails } = report;
    
    const wsData = [
      ['Reporte de Pagos Mensual'],
      ['Escuela:', school.name],
      ['Período:', `${period.monthName} ${period.year}`],
      [''],
      ['Resumen General'],
      ['Total de Cursos:', summary.totalCourses],
      ['Total de Estudiantes:', summary.totalStudents],
      ['Ingresos Totales:', summary.totalRevenue],
      ['Porcentaje de Pago:', `${summary.overallPaymentPercentage}%`],
      [''],
      ['Detalle por Curso'],
      ['Curso', 'Estudiantes', 'Con Pagos', 'Sin Pagos', 'Ingresos', '% Pago']
    ];
    
    courseDetails.forEach(course => {
      wsData.push([
        course.courseName,
        course.totalStudents,
        course.studentsWithPayments,
        course.studentsWithoutPayments,
        course.totalRevenue,
        `${course.paymentPercentage}%`
      ]);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(workbook, ws, 'Resumen');
  }

  private createCoursePaymentDetailSheet(workbook: XLSX.WorkBook, courseData: DetailedCoursePaymentData, period: any): void {
    const sheetName = courseData.courseName.substring(0, 31); // Excel sheet name limit
    
    // Create headers
    const headers = ['Estudiante', 'Email', 'Total Pagado', 'Estado de Pago', 'Número de Pagos', 'Detalles de Pagos'];
    
    // Create student rows
    const studentRows = courseData.studentDetails.map(student => {
      const paymentDetails = student.paymentRecords.length > 0 
        ? student.paymentRecords.map(payment => 
            `${payment.date}: $${payment.amount} (${payment.description})`
          ).join(' | ')
        : 'Sin pagos registrados';

      return [
        student.studentName,
        student.studentEmail,
        student.totalPaid,
        student.hasPayments ? 'Pagado' : 'Sin Pago',
        student.paymentRecords.length,
        paymentDetails
      ];
    });

    const sheetData = [
      [`${courseData.courseName} - ${period.monthName} ${period.year}`],
      [],
      ['Resumen del Curso:'],
      ['Total Estudiantes:', courseData.totalStudents],
      ['Estudiantes con Pagos:', courseData.studentsWithPayments],
      ['Estudiantes sin Pagos:', courseData.studentsWithoutPayments],
      ['Ingresos Totales:', courseData.totalRevenue],
      ['Porcentaje de Pago:', `${courseData.paymentPercentage}%`],
      [],
      headers,
      ...studentRows
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Estudiante
      { wch: 30 }, // Email
      { wch: 15 }, // Total Pagado
      { wch: 15 }, // Estado
      { wch: 15 }, // Número de Pagos
      { wch: 50 }  // Detalles
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }
} 