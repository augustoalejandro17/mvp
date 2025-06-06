export interface MonthlyReportParams {
  userId: string;
  userRole: string;
  schoolId?: string;
  month: number;
  year: number;
  courseId?: string;
}

export interface ExportReportParams extends MonthlyReportParams {
  format: 'csv' | 'excel';
}

export interface CourseAttendanceData {
  courseId: string;
  courseName: string;
  totalClasses: number;
  totalStudents: number;
  attendancePercentage: number;
  presentCount: number;
  absentCount: number;
}

export interface MonthlyAttendanceReport {
  school: {
    id: string;
    name: string;
  };
  period: {
    month: number;
    year: number;
    monthName: string;
  };
  summary: {
    totalCourses: number;
    totalClasses: number;
    totalStudents: number;
    overallAttendancePercentage: number;
  };
  courseDetails: CourseAttendanceData[];
}

export interface ExportResult {
  data: string;
  filename: string;
} 