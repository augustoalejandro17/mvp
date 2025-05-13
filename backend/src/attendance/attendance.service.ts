import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

      // Create exact date object without timezone manipulation
      const attendanceDate = new Date(createAttendanceDto.date);
      console.log(`Original date string: ${createAttendanceDto.date}`);
      console.log(`Parsed date: ${attendanceDate.toISOString()}`);
      
      // Create date range for queries - using UTC hours to maintain the day boundary
      const startDate = new Date(attendanceDate);
      startDate.setUTCHours(0, 0, 0, 0);
      
      const endDate = new Date(attendanceDate);
      endDate.setUTCHours(23, 59, 59, 999);
      
      console.log(`Search range: ${startDate.toISOString()} to ${endDate.toISOString()}`);

      // Verificar si ya existe un registro para este estudiante en esta fecha para este curso
      const existingAttendance = await this.attendanceModel.findOne({
        course: createAttendanceDto.courseId,
        student: createAttendanceDto.studentId,
        studentModel: 'User',
        date: {
          $gte: startDate,
          $lt: endDate
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
        date: attendanceDate,
        present: createAttendanceDto.present,
        notes: createAttendanceDto.notes,
        markedBy: teacherId,
        recordedBy: teacherId
      });
      
      const savedAttendance = await attendance.save();
      console.log(`Saved attendance with date: ${savedAttendance.date.toISOString()}`);
      return savedAttendance;
    } else {
      // Para usuario no registrado
      return this.createForNonRegisteredUser(
        createAttendanceDto.courseId,
        createAttendanceDto.studentId, // En este caso, el ID es el nombre
        new Date(createAttendanceDto.date), 
        createAttendanceDto.present,
        createAttendanceDto.notes || '',
        teacherId
      );
    }
  }

  // Registrar asistencia masiva (para múltiples estudiantes a la vez)
  async createBulk(bulkAttendanceDto: BulkAttendanceDto, teacherId: string): Promise<Attendance[]> {
    
    
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
      
      // Create an exact date object from the input without manipulation
      const attendanceDate = new Date(bulkAttendanceDto.date);
      
      // Log the input date and the parsed date for debugging
      console.log(`Original date string: ${bulkAttendanceDto.date}`);
      console.log(`Parsed date: ${attendanceDate.toISOString()}`);
      
      // Create date range for queries that preserves the original date's day
      // Only changing the time components to capture the entire day
      const startDate = new Date(attendanceDate);
      startDate.setUTCHours(0, 0, 0, 0);
      
      const endDate = new Date(attendanceDate);
      endDate.setUTCHours(23, 59, 59, 999);
      
      console.log(`Search range: ${startDate.toISOString()} to ${endDate.toISOString()}`);
      
      // Procesar cada asistencia de estudiantes registrados
      for (const attendanceData of registeredAttendances) {
        // Buscar si ya existe un registro para este estudiante en esta fecha
        const existingAttendance = await this.attendanceModel.findOne({
          course: bulkAttendanceDto.courseId,
          student: attendanceData.studentId,
          date: {
            $gte: startDate,
            $lt: endDate
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
            date: attendanceDate,
            present: attendanceData.present,
            notes: attendanceData.notes,
            markedBy: teacherId,
            recordedBy: teacherId
          });
          registeredResults.push(await newAttendance.save());
        }
      }
    }
    
    // Procesar estudiantes no registrados
    const nonRegisteredResults: Attendance[] = [];
    
    if (nonRegisteredAttendances.length > 0) {
      // Create an exact date object from the input without manipulation
      const attendanceDate = new Date(bulkAttendanceDto.date);
      
      // Create date range for queries that preserves the original date's day
      const startDate = new Date(attendanceDate);
      startDate.setUTCHours(0, 0, 0, 0);
      
      const endDate = new Date(attendanceDate);
      endDate.setUTCHours(23, 59, 59, 999);
      
      // Para cada estudiante no registrado, añadir un registro de asistencia
      for (const attendanceData of nonRegisteredAttendances) {
        // Buscar si ya existe un registro para este nombre en esta fecha
        const existingAttendance = await this.attendanceModel.findOne({
          course: bulkAttendanceDto.courseId,
          student: attendanceData.studentId,
          studentModel: 'String',
          date: {
            $gte: startDate,
            $lt: endDate
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
            attendanceDate,
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
      .populate({ path: 'student', strictPopulate: false })
      .populate({ path: 'course', strictPopulate: false })
      .populate({ path: 'markedBy', strictPopulate: false })
      .populate({ path: 'recordedBy', strictPopulate: false });
      
    if (!attendance) {
      throw new NotFoundException(`Registro de asistencia con ID ${id} no encontrado`);
    }
    
    return attendance;
  }

  // Obtener asistencia por curso y fecha
  async findByCourseAndDate(courseId: string, date: Date): Promise<Attendance[]> {
    // Create date range without timezone adjustments
    // Set the hours to cover the full day in UTC
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    
    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);
    
    console.log(`Finding attendance records for course ${courseId}`);
    console.log(`Date provided: ${date.toISOString()}`);
    console.log(`Search between: ${startDate.toISOString()} and ${endDate.toISOString()}`);
    
    const records = await this.attendanceModel.find({
      course: courseId,
      date: {
        $gte: startDate,
        $lt: endDate
      }
    })
    .populate({ path: 'student', strictPopulate: false })
    .sort('student.name')
    .exec();
    
    console.log(`Found ${records.length} attendance records`);
    records.forEach(record => {
      let studentIdStr = 'unknown';
      if (record.student) {
        if (typeof record.student === 'object' && record.student !== null) {
          studentIdStr = record.student.toString();
        } else {
          studentIdStr = String(record.student);
        }
      }
      console.log(`Record: studentId=${studentIdStr}, present=${record.present}, date=${record.date.toISOString()}`);
    });
    
    return records;
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
      }
      
      // Use exact date without timezone adjustment
      console.log(`Creating attendance with date: ${date.toISOString()}`);
      
      // Crear un nuevo registro de asistencia con el usuario no registrado
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
      console.log(`Saved attendance with date: ${savedAttendance.date.toISOString()}`);
      
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
    this.logger.debug(`Buscando asistencias para el curso ${courseId} en ${month}/${year}`);
    
    // Verificar que el curso existe
    const courseExists = await this.courseModel.exists({ _id: courseId });
    if (!courseExists) {
      throw new NotFoundException(`Curso con ID ${courseId} no encontrado`);
    }
    
    // Crear fechas de inicio y fin del mes (en UTC para evitar problemas de zona horaria)
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    
    this.logger.debug(`Rango de búsqueda: ${startDate.toISOString()} a ${endDate.toISOString()}`);
    
    // Buscar todas las asistencias para este curso en el rango de fechas
    const attendances = await this.attendanceModel.find({
      course: courseId,
      date: {
        $gte: startDate,
        $lte: endDate
      }
    })
    .populate('student', 'name email role') // Poblar información de estudiantes registrados
    .sort({ date: 1 }) // Ordenar por fecha
    .exec();
    
    this.logger.debug(`Se encontraron ${attendances.length} registros de asistencia`);
    
    return attendances;
  }
} 