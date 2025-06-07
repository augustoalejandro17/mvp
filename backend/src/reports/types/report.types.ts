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

// New interfaces for detailed Excel export
export interface StudentAttendanceDetail {
  studentId: string;
  studentName: string;
  studentEmail: string;
  attendanceRecords: Array<{
    date: string;
    present: boolean;
    classTitle?: string;
  }>;
  totalPresent: number;
  totalAbsent: number;
  attendancePercentage: number;
}

export interface DetailedCourseAttendanceData extends CourseAttendanceData {
  studentDetails: StudentAttendanceDetail[];
  classDates: string[]; // All unique class dates for this course
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
  isSingleCourseView?: boolean;
  detailedCourseData?: DetailedCourseAttendanceData[];
}

export interface DetailedMonthlyAttendanceReport extends MonthlyAttendanceReport {
  detailedCourseData: DetailedCourseAttendanceData[];
}

export interface ExportResult {
  data: string | Buffer;
  filename: string;
  contentType: string;
}

// Payment report interfaces
export interface CoursePaymentData {
  courseId: string;
  courseName: string;
  totalStudents: number;
  studentsWithPayments: number;
  studentsWithoutPayments: number;
  totalRevenue: number;
  paymentPercentage: number;
}

export interface StudentPaymentDetail {
  studentId: string;
  studentName: string;
  studentEmail: string;
  paymentRecords: Array<{
    date: string;
    amount: number;
    description?: string;
  }>;
  totalPaid: number;
  hasPayments: boolean;
}

export interface DetailedCoursePaymentData extends CoursePaymentData {
  studentDetails: StudentPaymentDetail[];
}

export interface MonthlyPaymentReport {
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
    totalStudents: number;
    totalRevenue: number;
    overallPaymentPercentage: number;
  };
  courseDetails: CoursePaymentData[];
  isSingleCourseView?: boolean;
  detailedCourseData?: DetailedCoursePaymentData[];
}

export interface DetailedMonthlyPaymentReport extends MonthlyPaymentReport {
  detailedCourseData: DetailedCoursePaymentData[];
} 