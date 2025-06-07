import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as XLSX from 'xlsx';
import { User, UserRole } from '../users/schemas/user.schema';
import { Course } from '../courses/schemas/course.schema';
import { School } from '../schools/schemas/school.schema';
import { UsersService } from '../users/users.service';
import { CoursesService } from '../courses/courses.service';

export interface BulkUploadData {
  curso: string;
  profesor: string;
  estudiante: string;
  edad?: number;
  email?: string;
  celular?: string;
  estado?: string;
}

export interface BulkUploadResult {
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: Array<{
    row: number;
    error: string;
    data: any;
  }>;
  createdUsers: number;
  createdCourses: number;
  createdTeachers: number;
  enrollments: number;
}

export interface BulkUploadConfig {
  schoolId: string;
  createMissingCourses: boolean;
  createMissingTeachers: boolean;
  studentType: 'assistant' | 'registered';
}

@Injectable()
export class BulkUploadService {
  private readonly logger = new Logger(BulkUploadService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    private usersService: UsersService,
    private coursesService: CoursesService,
  ) {}

  async parseExcelFile(buffer: Buffer): Promise<BulkUploadData[]> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        throw new BadRequestException('Excel file must have at least a header row and one data row');
      }

      // Find header row (look for "CURSO" column)
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(10, jsonData.length); i++) {
        const row = jsonData[i] as string[];
        if (row.some(cell => cell && cell.toString().toUpperCase().includes('CURSO'))) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        throw new BadRequestException('Could not find header row with "CURSO" column');
      }

      const headers = jsonData[headerRowIndex] as string[];
      const dataRows = jsonData.slice(headerRowIndex + 1) as string[][];

      // Map column indices
      const courseIndex = this.findColumnIndex(headers, ['CURSO']);
      const teacherIndex = this.findColumnIndex(headers, ['PROFESOR', 'PROFE']);
      const studentIndex = this.findColumnIndex(headers, ['ESTUDIANTE', 'ALUMNO', 'NOMBRE']);
      const ageIndex = this.findColumnIndex(headers, ['EDAD']);
      const emailIndex = this.findColumnIndex(headers, ['CORREO', 'EMAIL']);
      const phoneIndex = this.findColumnIndex(headers, ['CELULAR', 'TELEFONO']);
      const statusIndex = this.findColumnIndex(headers, ['ESTADO']);

      if (courseIndex === -1 || teacherIndex === -1 || studentIndex === -1) {
        throw new BadRequestException('Required columns not found: CURSO, PROFE, ESTUDIANTE');
      }

      const parsedData: BulkUploadData[] = [];

      for (const row of dataRows) {
        // Skip empty rows
        if (!row[studentIndex] || row[studentIndex].toString().trim() === '') {
          continue;
        }

        const data: BulkUploadData = {
          curso: row[courseIndex]?.toString().trim() || '',
          profesor: row[teacherIndex]?.toString().trim() || '',
          estudiante: row[studentIndex]?.toString().trim() || '',
          edad: ageIndex !== -1 ? this.parseAge(row[ageIndex]) : undefined,
          email: emailIndex !== -1 ? row[emailIndex]?.toString().trim() : undefined,
          celular: phoneIndex !== -1 ? row[phoneIndex]?.toString().trim() : undefined,
          estado: statusIndex !== -1 ? row[statusIndex]?.toString().trim() : undefined,
        };

        // Only add if we have the required fields
        if (data.curso && data.profesor && data.estudiante) {
          parsedData.push(data);
        }
      }

      this.logger.log(`Parsed ${parsedData.length} valid rows from Excel file`);
      return parsedData;

    } catch (error) {
      this.logger.error(`Error parsing Excel file: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to parse Excel file: ${error.message}`);
    }
  }

  async processBulkUpload(
    data: BulkUploadData[],
    config: BulkUploadConfig,
    adminUserId: string
  ): Promise<BulkUploadResult> {
    const result: BulkUploadResult = {
      totalRows: data.length,
      successCount: 0,
      errorCount: 0,
      errors: [],
      createdUsers: 0,
      createdCourses: 0,
      createdTeachers: 0,
      enrollments: 0,
    };

    // Verify school exists
    const school = await this.schoolModel.findById(config.schoolId);
    if (!school) {
      throw new NotFoundException(`School with ID ${config.schoolId} not found`);
    }

    // Track created entities to avoid duplicates
    const createdCourses = new Map<string, string>(); // courseName -> courseId
    const createdTeachers = new Map<string, string>(); // teacherName -> teacherId

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // 1. Find or create teacher
        let teacherId = createdTeachers.get(row.profesor.toLowerCase());
        if (!teacherId) {
          teacherId = await this.findOrCreateTeacher(row.profesor, config.createMissingTeachers);
          if (teacherId) {
            createdTeachers.set(row.profesor.toLowerCase(), teacherId);
            if (!await this.userModel.findById(teacherId)) {
              result.createdTeachers++;
            }
          }
        }

        if (!teacherId) {
          throw new Error(`Teacher "${row.profesor}" not found and creation disabled`);
        }

        // 2. Find or create course
        let courseId = createdCourses.get(row.curso.toLowerCase());
        if (!courseId) {
          courseId = await this.findOrCreateCourse(
            row.curso,
            teacherId,
            config.schoolId,
            config.createMissingCourses
          );
          if (courseId) {
            createdCourses.set(row.curso.toLowerCase(), courseId);
          }
        }

        if (!courseId) {
          throw new Error(`Course "${row.curso}" not found and creation disabled`);
        }

        // 3. Create student (assistant)
        const studentId = await this.createAssistant(row, config.schoolId);
        result.createdUsers++;

        // 4. Enroll student in course
        await this.enrollStudentInCourse(studentId, courseId, adminUserId);
        result.enrollments++;

        result.successCount++;

      } catch (error) {
        this.logger.error(`Error processing row ${i + 1}: ${error.message}`, error.stack);
        result.errors.push({
          row: i + 1,
          error: error.message,
          data: row,
        });
        result.errorCount++;
      }
    }

    this.logger.log(`Bulk upload completed: ${result.successCount}/${result.totalRows} successful`);
    return result;
  }

  private findColumnIndex(headers: string[], possibleNames: string[]): number {
    for (const name of possibleNames) {
      const index = headers.findIndex(header => 
        header && header.toString().toUpperCase().includes(name.toUpperCase())
      );
      if (index !== -1) return index;
    }
    return -1;
  }

  private parseAge(ageValue: any): number | undefined {
    if (!ageValue) return undefined;
    
    const ageStr = ageValue.toString().trim();
    const ageMatch = ageStr.match(/(\d+)/);
    
    if (ageMatch) {
      const age = parseInt(ageMatch[1]);
      return age > 0 && age < 120 ? age : undefined;
    }
    
    return undefined;
  }

  private async findOrCreateTeacher(teacherName: string, createIfMissing: boolean): Promise<string | null> {
    // Try to find existing teacher by name
    const existingTeacher = await this.userModel.findOne({
      name: { $regex: new RegExp(teacherName, 'i') },
      role: UserRole.TEACHER
    });

    if (existingTeacher) {
      return existingTeacher._id.toString();
    }

    if (!createIfMissing) {
      return null;
    }

    // Create new teacher
    const timestamp = Date.now();
    const teacherEmail = `teacher.${timestamp}@temp.local`;
    
    const newTeacher = await this.usersService.create({
      name: teacherName,
      email: teacherEmail,
      password: 'temp123', // Will be hashed by the service
      role: UserRole.TEACHER,
    });

    this.logger.log(`Created new teacher: ${teacherName} (${(newTeacher as any)._id})`);
    return (newTeacher as any)._id.toString();
  }

  private async findOrCreateCourse(
    courseName: string,
    teacherId: string,
    schoolId: string,
    createIfMissing: boolean
  ): Promise<string | null> {
    // Try to find existing course by name and school
    const existingCourse = await this.courseModel.findOne({
      title: { $regex: new RegExp(courseName, 'i') },
      school: new Types.ObjectId(schoolId)
    });

    if (existingCourse) {
      return existingCourse._id.toString();
    }

    if (!createIfMissing) {
      return null;
    }

    // Create new course
    const newCourse = await this.coursesService.create({
      title: courseName,
      description: `Auto-created from bulk upload`,
      teacher: teacherId,
      schoolId: schoolId,
      isPublic: false,
    }, teacherId);

    this.logger.log(`Created new course: ${courseName} (${(newCourse as any)._id})`);
    return (newCourse as any)._id.toString();
  }

  private async createAssistant(data: BulkUploadData, schoolId: string): Promise<string> {
    // Check if assistant already exists
    const existingUser = await this.userModel.findOne({
      name: { $regex: new RegExp(data.estudiante, 'i') },
      role: { $in: [UserRole.STUDENT, 'unregistered'] }
    });

    if (existingUser) {
      this.logger.log(`Assistant already exists: ${data.estudiante} (${existingUser._id})`);
      return existingUser._id.toString();
    }

    // Create new assistant (unregistered user)
    const newAssistant = await this.usersService.createUnregisteredUser(
      data.estudiante,
      undefined, // courseId will be set during enrollment
      schoolId
    );

    // Add age if provided
    if (data.edad && newAssistant) {
      await this.userModel.updateOne(
        { _id: (newAssistant as any)._id },
        { age: data.edad }
      );
    }

    this.logger.log(`Created new assistant: ${data.estudiante} (${(newAssistant as any)._id})`);
    return (newAssistant as any)._id.toString();
  }

  private async enrollStudentInCourse(studentId: string, courseId: string, adminUserId: string): Promise<void> {
    try {
      await this.coursesService.enrollStudent(courseId, studentId, adminUserId);
      this.logger.log(`Enrolled student ${studentId} in course ${courseId}`);
    } catch (error) {
      // If already enrolled, that's OK
      if (error.message?.includes('already enrolled')) {
        this.logger.log(`Student ${studentId} already enrolled in course ${courseId}`);
        return;
      }
      throw error;
    }
  }
} 