import { Injectable, NotFoundException, BadRequestException, Logger, forwardRef, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance, AttendanceDocument } from './schemas/attendance.schema';
import { User, UserRole } from '../auth/schemas/user.schema';
import { Course } from '../courses/schemas/course.schema';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { BulkAttendanceDto } from './dto/bulk-attendance.dto';
import { toDate } from 'date-fns-tz';
import { CoursesService } from '../courses/courses.service';

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @Inject(forwardRef(() => CoursesService)) private coursesService: CoursesService,
  ) {}

  // Registrar asistencia individual
  async create(createAttendanceDto: CreateAttendanceDto, teacherId: string): Promise<Attendance> {
    const { courseId, studentId, date: dateString, present, notes } = createAttendanceDto;
    
    // Verificar que el curso existe
    const course = await this.courseModel.findById(courseId);
    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }
    
    // Se asume que studentId es un ObjectId de un usuario existente (registrado o no registrado)
    // La validación de IsMongoId en el DTO debería ayudar si studentId no es un formato ObjectId,
    // aunque aquí studentId en DTO es IsString() para permitir flexibilidad pasada, ahora debería ser un ObjectId.
    // Idealmente, CreateAttendanceDto.studentId debería ser IsMongoId().
    if (!Types.ObjectId.isValid(studentId)) {
      throw new BadRequestException(`studentId inválido: ${studentId}. Debe ser un ObjectId.`);
    }
    
    const student = await this.userModel.findById(studentId);
      if (!student) {
      throw new NotFoundException(`Estudiante con ID ${studentId} no encontrado`);
      }
      
      // Verificar que el estudiante está matriculado en el curso
    // Esta validación es importante
      const isEnrolled = student.enrolledCourses.some(
      cId => cId.toString() === courseId
    );
    
    if (!isEnrolled && student.role !== UserRole.UNREGISTERED) {
        // Si es un usuario registrado (no UNREGISTERED) y no está en enrolledCourses, es un error.
        // Los usuarios UNREGISTERED se añaden a enrolledCourses en createForNonRegisteredUser.
        // Si llega aquí un UNREGISTERED que no está en enrolledCourses, algo falló antes.
        throw new BadRequestException(`El estudiante ${student.name} (ID: ${studentId}) no está matriculado en este curso.`);
    } else if (!isEnrolled && student.role === UserRole.UNREGISTERED) {
        // Si es un usuario UNREGISTERED y no está en la lista de enrolledCourses del modelo User,
        // pero sí está en la lista de students del modelo Course, lo permitimos.
        // Esto puede pasar si se añade como no registrado y aún no se ha sincronizado enrolledCourses.
        const courseContainsStudent = course.students.some(sId => sId.toString() === studentId);
        if (!courseContainsStudent) {
            throw new BadRequestException(`El estudiante no registrado (ID: ${studentId}) no está asociado a este curso.`);
        }
    }

    // Usar la fecha del DTO (dateString) para buscar registros existentes en ese día.
    // Obtener timezone de la escuela y crear rango UTC apropiado
    const searchDate = new Date(dateString);
    const school = await this.courseModel.findById(courseId).populate('school');
    const schoolTimezone = school?.school?.timezone || 'America/Bogota';
    const timezoneOffset = this.getTimezoneOffset(schoolTimezone);
    const adjustedDate = new Date(searchDate.getTime() - timezoneOffset * 60000);
    const localDateStr = adjustedDate.toISOString().split('T')[0];
    
    const [year, month, day] = localDateStr.split('-').map(Number);
    const startLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endLocal = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    
    const startDate = new Date(startLocal.getTime() + timezoneOffset * 60000);
    const endDate = new Date(endLocal.getTime() + timezoneOffset * 60000);
      
      const existingAttendance = await this.attendanceModel.findOne({
      course: courseId,
      student: studentId,
      date: { $gte: startDate, $lt: endDate }
      });

      if (existingAttendance) {
      existingAttendance.present = present;
      existingAttendance.notes = notes;
        existingAttendance.updatedAt = new Date();
      existingAttendance.recordedBy = teacherId as any; // Mongoose maneja la conversión String -> ObjectId
      existingAttendance.markedBy = teacherId as any;   // Mongoose maneja la conversión String -> ObjectId
        return existingAttendance.save();
      }
      
      const attendance = new this.attendanceModel({
      course: courseId,
      student: studentId,
        studentModel: 'User',
      date: searchDate, // Usar la fecha seleccionada, no la actual
      present: present,
      notes: notes,
      markedBy: teacherId, // Mongoose maneja la conversión String -> ObjectId
      recordedBy: teacherId // Mongoose maneja la conversión String -> ObjectId
      });
      
      const savedAttendance = await attendance.save();
      return savedAttendance;
  }

  // Registrar asistencia masiva (para múltiples estudiantes a la vez)
  async createBulk(bulkAttendanceDto: BulkAttendanceDto, teacherId: string): Promise<Attendance[]> {
    const { courseId, date: dateString, attendances } = bulkAttendanceDto;
    
    const course = await this.courseModel.findById(courseId).populate('school');
    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }
    
    const results: Attendance[] = [];
    
    const searchDate = new Date(dateString);
    const schoolTimezone = course?.school?.timezone || 'America/Bogota';
    const timezoneOffset = this.getTimezoneOffset(schoolTimezone);
    const adjustedDate = new Date(searchDate.getTime() - timezoneOffset * 60000);
    const localDateStr = adjustedDate.toISOString().split('T')[0];
    
    const [year, month, day] = localDateStr.split('-').map(Number);
    const startLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endLocal = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    
    const startDate = new Date(startLocal.getTime() + timezoneOffset * 60000);
    const endDate = new Date(endLocal.getTime() + timezoneOffset * 60000);
      
    for (const attendanceData of attendances) {
      const currentStudentId = attendanceData.studentId;
      const currentPresent = attendanceData.present;
      const currentNotes = attendanceData.notes;

      if (!Types.ObjectId.isValid(currentStudentId)) {
        this.logger.warn(`studentId inválido en bulk: ${currentStudentId}. Saltando este registro.`);
        continue; 
      }

      const student = await this.userModel.findById(currentStudentId);
      if (!student) {
        this.logger.warn(`Estudiante con ID ${currentStudentId} no encontrado en bulk. Saltando.`);
        continue;
        }

      const isEnrolled = student.enrolledCourses.some(cId => cId.toString() === courseId);
      if (!isEnrolled && student.role !== UserRole.UNREGISTERED) {
        this.logger.warn(`Estudiante ${student.name} (ID: ${currentStudentId}) no matriculado. Saltando.`);
        continue;
      } else if (!isEnrolled && student.role === UserRole.UNREGISTERED) {
        const courseContainsStudent = course.students.some(sId => sId.toString() === currentStudentId);
        if (!courseContainsStudent) {
            this.logger.warn(`Estudiante no registrado (ID: ${currentStudentId}) no asociado a este curso. Saltando.`);
            continue;
        }
      }

        const existingAttendance = await this.attendanceModel.findOne({
        course: courseId,
        student: currentStudentId,
        date: { $gte: startDate, $lt: endDate }
        });
        
        if (existingAttendance) {
        existingAttendance.present = currentPresent;
        existingAttendance.notes = currentNotes || existingAttendance.notes;
          existingAttendance.updatedAt = new Date();
        existingAttendance.recordedBy = teacherId as any; // Mongoose maneja la conversión
        existingAttendance.markedBy = teacherId as any;   // Mongoose maneja la conversión
        results.push(await existingAttendance.save());
        } else {
        const newAttendance = new this.attendanceModel({
          course: courseId,
          student: currentStudentId,
          studentModel: 'User',
          date: searchDate, // Usar la fecha seleccionada, no la actual
          present: currentPresent,
          notes: currentNotes,
          markedBy: teacherId, // Mongoose maneja la conversión
          recordedBy: teacherId // Mongoose maneja la conversión
        });
        results.push(await newAttendance.save());
        }
      }
    return results;
  }

  // Obtener asistencia por ID
  async findOne(id: string): Promise<Attendance> {
    const attendance = await this.attendanceModel.findById(id)
      .populate({ path: 'student', strictPopulate: false })
      .populate({ path: 'course', strictPopulate: false })
      .populate({ path: 'markedBy', strictPopulate: false })
      .populate({ path: 'recordedBy', strictPopulate: false });
      
    if (!attendance) {
      throw new NotFoundException(`Registro de asistencia con ID ${id} no encontrado`);
    }
    
    return attendance;
  }

  async findByCourseAndDate(courseId: string, date: Date): Promise<Attendance[]> {
    // Get school timezone for the course
    const course = await this.courseModel.findById(courseId).populate('school');
    const schoolTimezone = course?.school?.timezone || 'America/Bogota';
    const timezoneOffset = this.getTimezoneOffset(schoolTimezone);
    
    // Convert UTC date back to school timezone to get the local date
    const adjustedDate = new Date(date.getTime() - timezoneOffset * 60000);
    const localDateStr = adjustedDate.toISOString().split('T')[0];
    
    // Create UTC range for the local date
    const [year, month, day] = localDateStr.split('-').map(Number);
    const startLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endLocal = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    
    const startUTC = new Date(startLocal.getTime() + timezoneOffset * 60000);
    const endUTC = new Date(endLocal.getTime() + timezoneOffset * 60000);
    
    const records = await this.attendanceModel.find({
      course: courseId,
      date: {
        $gte: startUTC,
        $lt: endUTC
      }
    })
    .populate({ path: 'student', strictPopulate: false })
    .sort('student.name')
    .exec();
    return records;
  }

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

  async getStatsByCourse(courseId: string): Promise<any> {
    const course = await this.courseModel.findById(courseId).populate('students', 'name email');
    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }
    
    const totalClasses = await this.attendanceModel.distinct('date', { course: courseId });
    
    const studentStats = [];
    
    const students = Array.isArray(course.students) ? course.students : [];
    
    for (const student of students) {
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
    // Obtener todos los registros, incluidos aquellos donde el estudiante podría ser un string
    const records = await this.attendanceModel.find()
      .populate({ path: 'student', strictPopulate: false })
      .populate({ path: 'recordedBy', strictPopulate: false })
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
    // Verificar que el curso existe
    const course = await this.courseModel.findById(courseId).populate('school');
    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }
    
    // Obtener información de la escuela
    let schoolName = 'Desconocida';
    let schoolId: string;
    
    if (course.school) {
      if (typeof course.school === 'object' && course.school !== null) {
        schoolName = course.school['name'] || 'Desconocida';
        schoolId = course.school['_id'].toString();
      } else if (course.school) {
        // Si course.school es un string o ObjectId
        schoolId = course.school.toString();
      } else {
        // Fallback si course.school es null o undefined
        schoolId = new Types.ObjectId().toString();
      }
    } else {
      // Si no hay escuela, usar un ID genérico
      schoolId = new Types.ObjectId().toString();
    }
    
    
    try {
      // Buscar si existe un usuario con el mismo nombre y role UNREGISTERED
      let unregisteredUser = await this.userModel.findOne({
        name: studentName,
        role: UserRole.UNREGISTERED
      });
      
      // Si no existe, crear un nuevo usuario no registrado
      if (!unregisteredUser) {
        try {
          // Convertir IDs a ObjectId
          const courseObjectId = new Types.ObjectId(courseId);
          const schoolObjectId = new Types.ObjectId(schoolId);
          
          // Crear el nuevo usuario con las propiedades necesarias
          const newUserData = {
            name: studentName,
            role: UserRole.UNREGISTERED,
            isActive: true,
            enrolledCourses: [courseObjectId],
            schools: [schoolObjectId],
            schoolRoles: [{ 
              schoolId: schoolObjectId,
              role: UserRole.STUDENT
            }]
          };
          
          unregisteredUser = new this.userModel(newUserData);
          await unregisteredUser.save();
          
          // Agregar el usuario al curso si no está ya
          if (!course.students || !course.students.some(s => s?.toString() === unregisteredUser._id.toString())) {
            course.students = course.students || [];
            course.students.push(unregisteredUser._id as any);
            await course.save();
          }

          // Crear enrollment record para el nuevo usuario no registrado
          try {
            await this.coursesService.enrollStudent(courseId, unregisteredUser._id.toString(), teacherId);
          } catch (error) {
            // Si el enrollment ya existe o hay otro error no crítico, continuar
            this.logger.warn(`Could not create enrollment for new unregistered user: ${error.message}`);
          }
        } catch (error) {
          this.logger.error(`Error al crear usuario no registrado: ${error.message}`, error.stack);
          throw new BadRequestException(`Error al crear usuario no registrado: ${error.message}`);
        }
      } else {
        // Verificar si el curso ya está en enrolledCourses
        if (!unregisteredUser.enrolledCourses.some(c => c?.toString() === courseId)) {
          unregisteredUser.enrolledCourses.push(new Types.ObjectId(courseId) as any);
        }
        
        // Verificar si la escuela ya está en schools
        if (!unregisteredUser.schools || !unregisteredUser.schools.some(s => s?.toString() === schoolId)) {
          unregisteredUser.schools = unregisteredUser.schools || [];
          unregisteredUser.schools.push(new Types.ObjectId(schoolId) as any);
        }
        
        // Verificar si ya tiene el rol para esta escuela
        if (!unregisteredUser.schoolRoles || !unregisteredUser.schoolRoles.some(sr => sr.schoolId?.toString() === schoolId)) {
          unregisteredUser.schoolRoles = unregisteredUser.schoolRoles || [];
          unregisteredUser.schoolRoles.push({
            schoolId: new Types.ObjectId(schoolId) as any,
            role: UserRole.STUDENT
          });
        }
        
        await unregisteredUser.save();
        
        // Verificar si el usuario está en el curso
        if (!course.students || !course.students.some(s => s?.toString() === unregisteredUser._id.toString())) {
          course.students = course.students || [];
          course.students.push(unregisteredUser._id as any);
          await course.save();
        }

        // Crear enrollment record para el usuario no registrado
        try {
          await this.coursesService.enrollStudent(courseId, unregisteredUser._id.toString(), teacherId);
        } catch (error) {
          // Si el enrollment ya existe o hay otro error no crítico, continuar
          this.logger.warn(`Could not create enrollment for unregistered user: ${error.message}`);
        }
      }
      
      // Use timezone-aware date conversion
      // Get school timezone from course
      const schoolTimezone = course?.school?.timezone || 'America/Bogota';
      const timezoneOffset = this.getTimezoneOffset(schoolTimezone);
      
      // Crear rango de fechas para el día usando el timezone de la escuela
      const adjustedDate = new Date(date.getTime() - timezoneOffset * 60000);
      const localDateStr = adjustedDate.toISOString().split('T')[0];
      
      const [year, month, day] = localDateStr.split('-').map(Number);
      const startLocal = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const endLocal = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
      
      const startDate = new Date(startLocal.getTime() + timezoneOffset * 60000);
      const endDate = new Date(endLocal.getTime() + timezoneOffset * 60000);
      
      // Verificar si ya existe un registro para este usuario, curso y fecha
      const existingAttendance = await this.attendanceModel.findOne({
        course: courseId,
        student: unregisteredUser._id,
        date: {
          $gte: startDate,
          $lt: endDate
        }
      });
      if (existingAttendance) {
        existingAttendance.present = present;
        existingAttendance.notes = notes;
        existingAttendance.updatedAt = new Date();
        return existingAttendance.save();
      }
      // Si no existe, crear el nuevo registro
      const attendance = new this.attendanceModel({
        course: courseId,
        student: unregisteredUser._id,
        studentModel: 'User',
        date: date,
        present,
        notes,
        markedBy: teacherId,
        recordedBy: teacherId
      });
      const savedAttendance = await attendance.save();
      return savedAttendance;
    } catch (error) {
      this.logger.error(`Error en createForNonRegisteredUser: ${error.message}`, error.stack);
      throw error;
    }
  }

  // Vincular asistencias de un usuario no registrado a uno registrado
  async linkAttendancesToRegisteredUser(unregisteredName: string, userId: string): Promise<number> {
    // Verificar que el usuario registrado existe
    const registeredUser = await this.userModel.findById(userId);
    if (!registeredUser) {
      throw new NotFoundException(`Usuario con ID ${userId} no encontrado`);
    }
    
    // Buscar el usuario no registrado por nombre
    const unregisteredUser = await this.userModel.findOne({
      name: unregisteredName,
      role: UserRole.UNREGISTERED
    });
    
    if (!unregisteredUser) {
      // Si no existe un usuario no registrado, buscar asistencias antiguas con string
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
    
    // Si existe el usuario no registrado, actualizar sus asistencias
    const result = await this.attendanceModel.updateMany(
      { 
        student: unregisteredUser._id
      },
      {
        $set: {
          student: userId,
          updatedAt: new Date()
        }
      }
    );
    
    // Transferir los cursos del usuario no registrado al registrado
    if (unregisteredUser.enrolledCourses && unregisteredUser.enrolledCourses.length > 0) {
      for (const courseId of unregisteredUser.enrolledCourses) {
        if (!registeredUser.enrolledCourses.some(c => c.toString() === courseId.toString())) {
          registeredUser.enrolledCourses.push(courseId as any);
        }
      }
      await registeredUser.save();
    }
    
    // Desactivar el usuario no registrado
    unregisteredUser.isActive = false;
    await unregisteredUser.save();
    
    return result.modifiedCount;
  }

  async findByCourseAndMonth(courseId: string, year: number, month: number): Promise<Attendance[]> {
    // Verificar que el curso existe y obtener timezone de la escuela
    const course = await this.courseModel.findById(courseId).populate('school');
    if (!course) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }
    
    const schoolTimezone = course?.school?.timezone || 'America/Bogota';
    const timezoneOffset = this.getTimezoneOffset(schoolTimezone);
    
    // Start: First day of month at 00:00:00 in school timezone -> converted to UTC
    const startLocal = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const startUTC = new Date(startLocal.getTime() + timezoneOffset * 60000);
    
    // End: Last day of month at 23:59:59 in school timezone -> converted to UTC  
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // Get last day of month
    const endLocal = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999));
    const endUTC = new Date(endLocal.getTime() + timezoneOffset * 60000);
    
    // Buscar todas las asistencias para este curso en el rango de fechas
    const attendances = await this.attendanceModel.find({
      course: courseId,
      date: {
        $gte: startUTC,
        $lte: endUTC
      }
    })
    .populate('student', 'name email role') // Poblar información de estudiantes registrados
    .sort({ date: 1 }) // Ordenar por fecha
    .exec();
    
    return attendances;
  }

  private getTimezoneOffset(timezone: string): number {
    switch (timezone) {
      case 'America/Bogota':
        return 5 * 60; // GMT-5
      case 'America/New_York':
        return 5 * 60; // GMT-5 (EST)
      case 'America/Los_Angeles':
        return 8 * 60; // GMT-8 (PST)
      case 'UTC':
        return 0;
      case 'Europe/Madrid':
        return -1 * 60; // GMT+1
      default:
        return 5 * 60; // Default to GMT-5 (Bogota)
    }
  }
} 