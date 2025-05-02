import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { User, UserRole } from '../auth/schemas/user.schema';
import { Course } from '../courses/schemas/course.schema';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
  ) {}

  // Registrar asistencia individual
  async create(createAttendanceDto: CreateAttendanceDto, teacherId: string): Promise<Attendance> {
    this.logger.log(`Registrando asistencia para el estudiante ${createAttendanceDto.studentId} en el curso ${createAttendanceDto.courseId}`);
    
    // Verificar que el curso existe
    const course = await this.courseModel.findById(createAttendanceDto.courseId);
    if (!course) {
      throw new NotFoundException(`Curso con ID ${createAttendanceDto.courseId} no encontrado`);
    }
    
    // Verificar que el estudiante existe
    const student = await this.userModel.findById(createAttendanceDto.studentId);
    if (!student) {
      throw new NotFoundException(`Estudiante con ID ${createAttendanceDto.studentId} no encontrado`);
    }
    
    // Verificar que el estudiante está matriculado en el curso
    const isEnrolled = student.enrolledCourses.some(
      courseId => courseId.toString() === createAttendanceDto.courseId
    );
    
    if (!isEnrolled) {
      throw new BadRequestException(`El estudiante no está matriculado en este curso`);
    }

    // Verificar si ya existe un registro para este estudiante en esta fecha para este curso
    const existingAttendance = await this.attendanceModel.findOne({
      course: createAttendanceDto.courseId,
      student: createAttendanceDto.studentId,
      date: {
        $gte: new Date(createAttendanceDto.date.setHours(0, 0, 0, 0)),
        $lt: new Date(createAttendanceDto.date.setHours(23, 59, 59, 999))
      }
    });

    if (existingAttendance) {
      // Actualizar el registro existente
      existingAttendance.present = createAttendanceDto.present;
      existingAttendance.notes = createAttendanceDto.notes;
      existingAttendance.updatedAt = new Date();
      return existingAttendance.save();
    }
    
    // Crear un nuevo registro de asistencia
    const attendance = new this.attendanceModel({
      course: createAttendanceDto.courseId,
      student: createAttendanceDto.studentId,
      date: createAttendanceDto.date,
      present: createAttendanceDto.present,
      notes: createAttendanceDto.notes,
      markedBy: teacherId
    });
    
    return attendance.save();
  }

  // Registrar asistencia masiva (para múltiples estudiantes a la vez)
  async createBulk(bulkAttendanceDto: BulkAttendanceDto, teacherId: string): Promise<Attendance[]> {
    this.logger.log(`Registrando asistencia masiva para ${bulkAttendanceDto.attendances.length} estudiantes en el curso ${bulkAttendanceDto.courseId}`);
    
    // Verificar que el curso existe
    const course = await this.courseModel.findById(bulkAttendanceDto.courseId);
    if (!course) {
      throw new NotFoundException(`Curso con ID ${bulkAttendanceDto.courseId} no encontrado`);
    }
    
    // Obtener la lista de estudiantes
    const studentIds = bulkAttendanceDto.attendances.map(a => a.studentId);
    const students = await this.userModel.find({ _id: { $in: studentIds } });
    
    if (students.length !== studentIds.length) {
      throw new BadRequestException('Algunos estudiantes no se encontraron');
    }
    
    // Verificar que todos los estudiantes están matriculados en el curso
    const notEnrolledStudents = students.filter(student => 
      !student.enrolledCourses.some(courseId => 
        courseId.toString() === bulkAttendanceDto.courseId
      )
    );
    
    if (notEnrolledStudents.length > 0) {
      throw new BadRequestException(`Algunos estudiantes no están matriculados en este curso`);
    }
    
    // Procesar cada asistencia
    const results: Attendance[] = [];
    
    for (const attendanceData of bulkAttendanceDto.attendances) {
      // Buscar si ya existe un registro para este estudiante en esta fecha
      const existingAttendance = await this.attendanceModel.findOne({
        course: bulkAttendanceDto.courseId,
        student: attendanceData.studentId,
        date: {
          $gte: new Date(bulkAttendanceDto.date.setHours(0, 0, 0, 0)),
          $lt: new Date(bulkAttendanceDto.date.setHours(23, 59, 59, 999))
        }
      });
      
      if (existingAttendance) {
        // Actualizar el registro existente
        existingAttendance.present = attendanceData.present;
        existingAttendance.notes = attendanceData.notes || existingAttendance.notes;
        existingAttendance.updatedAt = new Date();
        results.push(await existingAttendance.save());
      } else {
        // Crear un nuevo registro
        const newAttendance = new this.attendanceModel({
          course: bulkAttendanceDto.courseId,
          student: attendanceData.studentId,
          date: bulkAttendanceDto.date,
          present: attendanceData.present,
          notes: attendanceData.notes,
          markedBy: teacherId
        });
        results.push(await newAttendance.save());
      }
    }
    
    return results;
  }

  // Obtener asistencia por ID
  async findOne(id: string): Promise<Attendance> {
    const attendance = await this.attendanceModel.findById(id)
      .populate('student', 'name email')
      .populate('course', 'title')
      .populate('markedBy', 'name email');
      
    if (!attendance) {
      throw new NotFoundException(`Registro de asistencia con ID ${id} no encontrado`);
    }
    
    return attendance;
  }

  // Obtener asistencia por curso y fecha
  async findByCourseAndDate(courseId: string, date: Date): Promise<Attendance[]> {
    return this.attendanceModel.find({
      course: courseId,
      date: {
        $gte: new Date(date.setHours(0, 0, 0, 0)),
        $lt: new Date(date.setHours(23, 59, 59, 999))
      }
    })
    .populate('student', 'name email')
    .sort('student.name');
  }

  // Obtener estadísticas de asistencia por curso
  async getStatsByStudent(courseId: string, studentId: string): Promise<any> {
    const totalAttendances = await this.attendanceModel.countDocuments({
      course: courseId,
      student: studentId
    });
    
    const presentCount = await this.attendanceModel.countDocuments({
      course: courseId,
      student: studentId,
      present: true
    });
    
    const absentCount = totalAttendances - presentCount;
    const attendanceRate = totalAttendances > 0 ? (presentCount / totalAttendances) * 100 : 0;
    
    return {
      total: totalAttendances,
      present: presentCount,
      absent: absentCount,
      attendanceRate: Math.round(attendanceRate * 100) / 100 // Redondear a 2 decimales
    };
  }

  // Obtener estadísticas de asistencia para todos los estudiantes de un curso
  async getStatsByCourse(courseId: string): Promise<any> {
    // Verificar que el curso existe
    const course = await this.courseModel.findById(courseId).populate('students', 'name email');
    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }
    
    const totalClasses = await this.attendanceModel.distinct('date', { course: courseId });
    
    // Obtener estadísticas para cada estudiante
    const studentStats = [];
    
    // Convertir a array si no lo es
    const students = Array.isArray(course.students) ? course.students : [];
    
    for (const student of students) {
      // Asegurar que student es un objeto y no solo un ObjectId
      let studentId: string;
      try {
        if (typeof student === 'object' && student !== null) {
          studentId = student.toString();
        } else {
          studentId = String(student);
        }
      } catch (err) {
        this.logger.error(`Error processing student ID: ${err.message}`);
        studentId = String(student);
      }
      
      const stats = await this.getStatsByStudent(courseId, studentId);
      
      // Buscar información completa del estudiante
      const studentData = await this.userModel.findById(studentId);
      
      studentStats.push({
        student: {
          id: studentId,
          name: studentData?.name || 'Unknown',
          email: studentData?.email || 'Unknown'
        },
        stats
      });
    }
    
    return {
      course: {
        id: course._id,
        title: course.title
      },
      totalClasses: totalClasses.length,
      students: studentStats
    };
  }

  // Actualizar un registro de asistencia
  async update(id: string, updateAttendanceDto: UpdateAttendanceDto): Promise<Attendance> {
    const attendance = await this.attendanceModel.findById(id);
    
    if (!attendance) {
      throw new NotFoundException(`Registro de asistencia con ID ${id} no encontrado`);
    }
    
    // Actualizar los campos proporcionados
    if (updateAttendanceDto.date) {
      attendance.date = updateAttendanceDto.date;
    }
    
    if (typeof updateAttendanceDto.present !== 'undefined') {
      attendance.present = updateAttendanceDto.present;
    }
    
    if (updateAttendanceDto.notes) {
      attendance.notes = updateAttendanceDto.notes;
    }
    
    attendance.updatedAt = new Date();
    
    return attendance.save();
  }

  // Eliminar un registro de asistencia
  async remove(id: string): Promise<{ success: boolean }> {
    const result = await this.attendanceModel.deleteOne({ _id: id });
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Registro de asistencia con ID ${id} no encontrado`);
    }
    
    return { success: true };
  }
} 