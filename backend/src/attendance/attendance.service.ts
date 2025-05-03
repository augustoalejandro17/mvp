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
    
    // Verificar si es un usuario registrado o no registrado
    const isRegisteredUser = createAttendanceDto.isRegistered !== false;
    
    if (isRegisteredUser) {
      // Verificar que el estudiante existe si es un usuario registrado
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
        studentModel: 'User',
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
      
      // Crear un nuevo registro de asistencia para usuario registrado
      const attendance = new this.attendanceModel({
        course: createAttendanceDto.courseId,
        student: createAttendanceDto.studentId,
        studentModel: 'User',
        date: createAttendanceDto.date,
        present: createAttendanceDto.present,
        notes: createAttendanceDto.notes,
        markedBy: teacherId
      });
      
      return attendance.save();
    } else {
      // Para usuario no registrado
      return this.createForNonRegisteredUser(
        createAttendanceDto.courseId,
        createAttendanceDto.studentId, // En este caso, el ID es el nombre
        createAttendanceDto.date,
        createAttendanceDto.present,
        createAttendanceDto.notes || '',
        teacherId
      );
    }
  }

  // Registrar asistencia masiva (para múltiples estudiantes a la vez)
  async createBulk(bulkAttendanceDto: BulkAttendanceDto, teacherId: string): Promise<Attendance[]> {
    this.logger.log(`Registrando asistencia masiva para ${bulkAttendanceDto.attendances.length} estudiantes en el curso ${bulkAttendanceDto.courseId}`);
    
    // Verificar que el curso existe
    const course = await this.courseModel.findById(bulkAttendanceDto.courseId);
    if (!course) {
      throw new NotFoundException(`Curso con ID ${bulkAttendanceDto.courseId} no encontrado`);
    }
    
    // Separar estudiantes registrados y no registrados
    const registeredAttendances = bulkAttendanceDto.attendances.filter(a => a.isRegistered !== false);
    const nonRegisteredAttendances = bulkAttendanceDto.attendances.filter(a => a.isRegistered === false);
    
    // Procesar estudiantes registrados
    const registeredResults: Attendance[] = [];
    
    if (registeredAttendances.length > 0) {
      // Obtener la lista de estudiantes registrados
      const studentIds = registeredAttendances.map(a => a.studentId);
      const students = await this.userModel.find({ _id: { $in: studentIds } });
      
      if (students.length !== studentIds.length) {
        throw new BadRequestException('Algunos estudiantes registrados no se encontraron');
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
      
      // Procesar cada asistencia de estudiantes registrados
      for (const attendanceData of registeredAttendances) {
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
          registeredResults.push(await existingAttendance.save());
        } else {
          // Crear un nuevo registro
          const newAttendance = new this.attendanceModel({
            course: bulkAttendanceDto.courseId,
            student: attendanceData.studentId,
            studentModel: 'User',
            date: bulkAttendanceDto.date,
            present: attendanceData.present,
            notes: attendanceData.notes,
            markedBy: teacherId
          });
          registeredResults.push(await newAttendance.save());
        }
      }
    }
    
    // Procesar estudiantes no registrados
    const nonRegisteredResults: Attendance[] = [];
    
    if (nonRegisteredAttendances.length > 0) {
      // Para cada estudiante no registrado, añadir un registro de asistencia
      for (const attendanceData of nonRegisteredAttendances) {
        // Buscar si ya existe un registro para este nombre en esta fecha
        const existingAttendance = await this.attendanceModel.findOne({
          course: bulkAttendanceDto.courseId,
          student: attendanceData.studentId,
          studentModel: 'String',
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
          nonRegisteredResults.push(await existingAttendance.save());
        } else {
          // Crear un nuevo registro con el nombre como identificador
          const nonRegisteredAttendance = await this.createForNonRegisteredUser(
            bulkAttendanceDto.courseId,
            attendanceData.studentId, // El ID en este caso es el nombre
            bulkAttendanceDto.date,
            attendanceData.present,
            attendanceData.notes || '',
            teacherId
          );
          
          nonRegisteredResults.push(nonRegisteredAttendance);
        }
      }
    }
    
    // Combinar resultados
    return [...registeredResults, ...nonRegisteredResults];
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

  // Obtener todos los registros de asistencia (para encontrar usuarios no registrados)
  async findAllRecords(): Promise<Attendance[]> {
    this.logger.log('Buscando todos los registros de asistencia para extraer usuarios no registrados');
    
    // Obtener todos los registros, incluidos aquellos donde el estudiante podría ser un string
    const records = await this.attendanceModel.find()
      .populate('course', 'title')
      .exec();
    
    return records;
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
    const result = await this.attendanceModel.deleteOne({ _id: id }).exec();
    
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Registro de asistencia con ID ${id} no encontrado`);
    }
    
    return { success: true };
  }

  // Crear asistencia para un usuario no registrado (solo nombre)
  async createForNonRegisteredUser(courseId: string, studentName: string, date: Date, present: boolean, notes: string, teacherId: string): Promise<Attendance> {
    this.logger.log(`Registrando asistencia para estudiante no registrado: ${studentName} en curso: ${courseId}`);
    
    // Verificar que el curso existe
    const course = await this.courseModel.findById(courseId);
    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }
    
    // Crear un nuevo registro de asistencia
    const attendance = new this.attendanceModel({
      course: courseId,
      student: studentName,  // Usar el nombre como identificador
      studentModel: 'String', // Indicar que es un string, no un ObjectId
      date,
      present,
      notes,
      markedBy: teacherId
    });
    
    return attendance.save();
  }

  // Vincular asistencias de un usuario no registrado a uno registrado
  async linkAttendancesToRegisteredUser(unregisteredName: string, userId: string): Promise<number> {
    this.logger.log(`Vinculando asistencias de usuario no registrado "${unregisteredName}" al usuario registrado ${userId}`);
    
    // Verificar que el usuario existe
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }
    
    // Actualizar todos los registros que coincidan con el nombre no registrado
    const result = await this.attendanceModel.updateMany(
      { 
        student: unregisteredName,
        studentModel: 'String'
      },
      {
        $set: {
          student: userId,
          studentModel: 'User',
          updatedAt: new Date()
        }
      }
    );
    
    return result.modifiedCount;
  }
} 