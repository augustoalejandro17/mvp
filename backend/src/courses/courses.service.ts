import { Injectable, NotFoundException, BadRequestException, Logger, UnauthorizedException, HttpException, InternalServerErrorException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course } from './schemas/course.schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { User } from '../auth/schemas/user.schema';
import { UserRole } from '../auth/enums/user-role.enum';
import { SchoolsService } from '../schools/schools.service';
import { Enrollment } from './schemas/enrollment.schema';
import { School } from '../schools/schemas/school.schema';
import { CreateClassDto } from '../classes/dto/create-class.dto';
import { CourseScheduleService } from './course-schedule.service';

// Función de utilidad para comparar roles
const compareRole = (userRole: any, enumRole: UserRole): boolean => {
  // Si los roles son directamente iguales (mismo enum)
  if (userRole === enumRole) return true;
  
  // Si no, comparamos los valores como strings para evitar problemas de tipos distintos
  const userRoleStr = String(userRole).toLowerCase();
  const enumRoleStr = String(enumRole).toLowerCase();
  
  return userRoleStr === enumRoleStr;
};

interface ClassItem {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  isPublic?: boolean;
  order?: number;
  [key: string]: any;
}

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
    private schoolsService: SchoolsService,
    private courseScheduleService: CourseScheduleService,
  ) {}

  async create(createCourseDto: CreateCourseDto, teacherId: string): Promise<Course> {
    const { schoolId, teacher, teachers, sede, scheduleTimes, enableNotifications, notificationMinutes, ...courseData } = createCourseDto;

    // Validate School
    const school = await this.schoolModel.findById(schoolId);
      if (!school) {
      throw new NotFoundException(`School with ID ${schoolId} not found`);
      }
      
    // Validate Sede if provided
    if (sede) {
      if (!school.sedes || school.sedes.length === 0) {
        throw new BadRequestException(`School ${school.name} does not have any sedes defined. Cannot assign course to a sede.`);
      }
      if (!school.sedes.includes(sede)) {
        throw new BadRequestException(`Sede '${sede}' is not a valid sede for school ${school.name}. Valid sedes are: ${school.sedes.join(', ')}`);
      }
    }

    // Validate Teacher
    if (!teacher) {
      throw new BadRequestException('Teacher is required');
    }
      
      // Verificar que el profesor principal exista
    const mainTeacher = await this.userModel.findById(teacher);
      if (!mainTeacher) {
      throw new BadRequestException(`El profesor principal con ID ${teacher} no existe`);
      }
      
      // Procesar lista de profesores adicionales
    let teachersArray = [teacher]; // Incluir profesor principal como el primer profesor
      
      // Si se proporcionaron profesores adicionales
    if (teachers && teachers.length > 0) {
        // Verificar que no exceda el límite de 5 profesores
      if (teachers.length > 4) { // 4 + 1 principal = 5 total
          throw new BadRequestException('Un curso no puede tener más de 5 profesores');
        }
        
        // Verificar que los profesores existan y eliminar duplicados
      const uniqueTeachers = new Set<string>([teacher]);
        
      for (const teacherId of teachers) {
          if (!uniqueTeachers.has(teacherId)) {
            const teacher = await this.userModel.findById(teacherId);
            if (!teacher) {
              throw new BadRequestException(`El profesor con ID ${teacherId} no existe`);
            }
            uniqueTeachers.add(teacherId);
          }
        }
        
        // Convertir el Set a un array para asignar a teachersArray
        teachersArray = Array.from(uniqueTeachers);
      }
      
      // Crear el curso con los profesores
      const createdCourse = new this.courseModel({
      title: courseData.title,
      description: courseData.description,
      coverImageUrl: courseData.coverImageUrl,
      isPublic: courseData.isPublic || false,
      school: schoolId,
      teacher: teacher,
      teachers: teachersArray,
      sede,
      promotionOrder: courseData.promotionOrder || 999,
      isFeatured: courseData.isFeatured || false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
      
      const result = await createdCourse.save();
      
      // Añadir el curso a la escuela
      try {
      await this.schoolsService.addCourse(schoolId, String(result._id));
      } catch (error) {
        this.logger.error(`Error al añadir curso a escuela: ${error.message}`, error.stack);
        // No lanzamos la excepción para evitar que falle la creación del curso
      }
      
      // Añadir el curso a los profesores adicionales
      for (const tId of teachersArray) {
        try {
          await this.userModel.findByIdAndUpdate(tId, {
            $addToSet: { teachingCourses: result._id }
          });
        } catch (error) {
          this.logger.error(`Error al añadir curso al profesor ${tId}: ${error.message}`, error.stack);
        }
      }

      // Create schedule if provided
      if (scheduleTimes && scheduleTimes.length > 0) {
        try {
          await this.courseScheduleService.createSchedule(String(result._id), {
            scheduleTimes,
            enableNotifications: enableNotifications ?? true,
            notificationMinutes: notificationMinutes || 10
          });
        } catch (error) {
          this.logger.error(`Error creating schedule for course ${result._id}: ${error.message}`, error.stack);
          // Don't fail course creation if schedule fails
        }
      }
      
      return result;
  }

  async findAll(userId?: string, role?: UserRole | string, schoolId?: string) {
    try {
      let query: any = {};
      const conditions = []; // Usaremos un array para construir condiciones $or o $and más complejas

      // Si se especifica una escuela, es una condición principal
      if (schoolId) {
        query.school = new Types.ObjectId(schoolId);
      }
      
      const roleStr = role ? String(role).toLowerCase() : '';
      
      const isAdminRole = [
        UserRole.SUPER_ADMIN.toLowerCase(),
        'superadmin', // common alias
        UserRole.SCHOOL_OWNER.toLowerCase(),
        UserRole.ADMINISTRATIVE.toLowerCase(),
        UserRole.ADMIN.toLowerCase()
      ].includes(roleStr);

      if (isAdminRole) {
        // Los administradores ven todos los cursos (públicos y privados) de la escuela (si se especifica) o de todas las escuelas.
        // No se necesita query.isPublic = true ni otras condiciones de visibilidad.
      } else if (!userId || !role) {
        // No autenticado o sin rol: solo cursos públicos
        query.isPublic = true;
      } else {
        // Usuario autenticado (profesor, estudiante, u otro)
        const userSpecificConditions: any[] = [];

        userSpecificConditions.push({ isPublic: true });

        if (roleStr === UserRole.TEACHER.toLowerCase()) { 
          userSpecificConditions.push({ teacher: new Types.ObjectId(userId) });
          userSpecificConditions.push({ teachers: new Types.ObjectId(userId) });
          userSpecificConditions.push({ students: new Types.ObjectId(userId) }); 
        } else { 
          userSpecificConditions.push({ students: new Types.ObjectId(userId) });
        }
        
        // Si hay condiciones específicas del usuario, se combinan con $or
        if (userSpecificConditions.length > 0) {
          query.$or = userSpecificConditions;
        }
      }
      
      const courses = await this.courseModel.find(query)
        .populate('school', 'name')
        .populate('teacher', 'name email')
        .populate('teachers', 'name email')
        .select('-students -classes')
        .sort({ promotionOrder: 1, title: 1 });
      
      return courses;
    } catch (error) {
      this.logger.error(`Error al buscar cursos: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findOne(id: string) {
    try {
      const course = await this.courseModel.findById(id)
        .populate('teacher', 'name email')
        .populate('teachers', 'name email')
        .populate('school', 'name logoUrl')
        .populate('students', 'name email status')
        .populate({
          path: 'classes',
          options: { sort: { order: 1 } }
        })
        .lean();
      
      if (!course) {
        throw new NotFoundException(`Curso con ID ${id} no encontrado`);
      }
      
      const courseWithVisibility = {
        ...course,
        classes: Array.isArray(course.classes) ? course.classes.map(classItem => {
          // Safely check if isPublic and order properties exist
          const isPublic = typeof classItem === 'object' && 'isPublic' in classItem ? classItem.isPublic : false;
          const order = typeof classItem === 'object' && 'order' in classItem ? classItem.order : 0;
          
          return {
            ...classItem,
            // Mark only the first class as visible by default
            isVisible: isPublic === true || order === 1 || order === 0,
          };
        }) : []
      };
      
      return courseWithVisibility;
    } catch (error) {
      this.logger.error(`Error al buscar curso ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async update(id: string, updateCourseDto: UpdateCourseDto, userId: string): Promise<Course> {
    const { schoolId, teacher, teachers, sede, scheduleTimes, enableNotifications, notificationMinutes, ...courseData } = updateCourseDto;
      const course = await this.courseModel.findById(id);
      
      if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
      }
      
    // Basic permission check (user must be admin or teacher of the course or school admin)
    // This should be expanded with more granular role-based access control
    const school = await this.schoolModel.findById(course.school).populate('admin');
    if (!school) {
      throw new NotFoundException(`School for course with ID ${id} not found`);
      }
      
    const isAdmin = school.admin && (school.admin as any)._id.toString() === userId;
    const isCourseTeacher = course.teacher.toString() === userId || (course.teachers && course.teachers.some(t => t.toString() === userId));
    const user = await this.userModel.findById(userId);
    const isSuperAdmin = user && user.role === UserRole.SUPER_ADMIN;
      
    if (!isAdmin && !isCourseTeacher && !isSuperAdmin) {
      throw new UnauthorizedException('You do not have permission to update this course');
      }
      
    // Validate Sede if provided or changed
    if (sede !== undefined) { // If sede is part of the update
      const targetSchoolId = schoolId || course.school.toString();
      const targetSchool = schoolId ? await this.schoolModel.findById(schoolId) : school;
      
      if (!targetSchool) {
        throw new NotFoundException(`Target school with ID ${targetSchoolId} not found for sede validation.`);
        }

      if (sede === '' || sede === null) { // Allowing to remove/nullify sede
        course.sede = null; // Assign null directly to the course model property
      } else {
        if (!targetSchool.sedes || targetSchool.sedes.length === 0) {
          throw new BadRequestException(`School ${targetSchool.name} does not have any sedes defined. Cannot assign course to a sede.`);
        }
        if (!targetSchool.sedes.includes(sede)) {
          throw new BadRequestException(`Sede '${sede}' is not a valid sede for school ${targetSchool.name}. Valid sedes are: ${targetSchool.sedes.join(', ')}`);
        }
      }
    }

    // If schoolId is being changed, validate the new school and its sedes
    if (schoolId && schoolId !== course.school.toString()) {
      const newSchool = await this.schoolModel.findById(schoolId);
      if (!newSchool) {
        throw new NotFoundException(`New school with ID ${schoolId} not found`);
          }
      // If changing school and a sede is specified, it must be valid for the NEW school
      if (sede) {
        if (!newSchool.sedes || newSchool.sedes.length === 0) {
          throw new BadRequestException(`New school ${newSchool.name} does not have any sedes defined for sede '${sede}'.`);
        }
        if (!newSchool.sedes.includes(sede)) {
          throw new BadRequestException(`Sede '${sede}' is not valid for new school ${newSchool.name}. Valid sedes are: ${newSchool.sedes.join(', ')}`);
        }
      } else {
        // If changing school and NO sede is specified, clear the sede field if the new school has multiple sedes (force selection)
        // Or, if new school has only one sede, could auto-assign it (optional complexity)
        // For now, if new school has sedes and no sede provided in DTO, we might clear it or require it.
        // Current logic: if DTO.sede is undefined, it won't be updated unless explicitly set to null.
      }
    }

    // Update course fields
    Object.assign(course, courseData); // Apply other changes from courseData
    if (schoolId) course.school = new Types.ObjectId(schoolId) as any;
    if (teacher) course.teacher = new Types.ObjectId(teacher) as any;
    if (teachers) course.teachers = teachers.map(tId => new Types.ObjectId(tId) as any);
    if (sede !== undefined) course.sede = sede; // Apply sede if it was in DTO

    course.updatedAt = new Date();
    const updatedCourse = await course.save();

    // Update schedule if provided
    if (scheduleTimes !== undefined) {
      try {
        if (scheduleTimes.length === 0) {
          // If empty array, delete existing schedule
          await this.courseScheduleService.deleteSchedule(id);
        } else {
          // Check if schedule exists
          const existingSchedule = await this.courseScheduleService.getSchedule(id);
          if (existingSchedule) {
            // Update existing schedule
            await this.courseScheduleService.updateSchedule(id, {
              scheduleTimes,
              enableNotifications: enableNotifications ?? existingSchedule.enableNotifications,
              notificationMinutes: notificationMinutes || existingSchedule.notificationMinutes
            });
          } else {
            // Create new schedule
            await this.courseScheduleService.createSchedule(id, {
              scheduleTimes,
              enableNotifications: enableNotifications ?? true,
              notificationMinutes: notificationMinutes || 10
            });
          }
        }
      } catch (error) {
        this.logger.error(`Error updating schedule for course ${id}: ${error.message}`, error.stack);
        // Don't fail course update if schedule fails
      }
    }

    return updatedCourse;
  }

  async addStudent(courseId: string, studentId: string, userId: string) {
    try {
      const course = await this.courseModel.findById(courseId);
      
      if (!course) {
        throw new NotFoundException('Curso no encontrado');
      }
      
      // Verificar permisos (profesor del curso o admin)
      const isTeacher = course.teacher.toString() === userId;
      
      if (!isTeacher) {
        const user = await this.userModel.findById(userId);
        if (!user || !compareRole(user.role, UserRole.ADMIN)) {
          throw new BadRequestException('No tiene permisos para modificar este curso');
        }
      }
      
      // Verificar que el estudiante exista
      const student = await this.userModel.findById(studentId);
      if (!student) {
        throw new NotFoundException('Estudiante no encontrado');
      }
      
      // Actualizar el curso
      await this.courseModel.findByIdAndUpdate(courseId, {
        $addToSet: { students: studentId }
      });
      
      // Actualizar el estudiante
      await this.userModel.findByIdAndUpdate(studentId, {
        $addToSet: { enrolledCourses: courseId }
      });
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al añadir estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  async removeStudent(courseId: string, studentId: string, userId: string) {
    try {
      const course = await this.courseModel.findById(courseId);
      
      if (!course) {
        throw new NotFoundException('Curso no encontrado');
      }
      
      // Verificar permisos (profesor del curso o admin)
      const isTeacher = course.teacher.toString() === userId;
      
      if (!isTeacher) {
        const user = await this.userModel.findById(userId);
        if (!user || !compareRole(user.role, UserRole.ADMIN)) {
          throw new BadRequestException('No tiene permisos para modificar este curso');
        }
      }
      
      // Actualizar el curso
      await this.courseModel.findByIdAndUpdate(courseId, {
        $pull: { students: studentId }
      });
      
      // Actualizar el estudiante
      await this.userModel.findByIdAndUpdate(studentId, {
        $pull: { enrolledCourses: courseId }
      });
      
      return { success: true };
    } catch (error) {
      this.logger.error(`Error al eliminar estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  async addClass(courseId: string, classId: string): Promise<Course> {
    const result = await this.courseModel.findByIdAndUpdate(
      courseId,
      { $addToSet: { classes: classId } },
      { new: true }
    );
    
    if (!result) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    
    return result;
  }

  async remove(id: string, userId: string, userRoleString?: string) {
    try {
      // Populamos la escuela para acceder a sus campos (admin, administratives, etc.)
      const course = await this.courseModel.findById(id).populate('school').exec(); 
      
      if (!course) {
        throw new NotFoundException(`Curso con ID ${id} no encontrado`);
      }

      const userRequesting = await this.userModel.findById(userId).exec(); // Cambiado a userRequesting para claridad
      if (!userRequesting) {
        throw new UnauthorizedException('Usuario solicitante no encontrado.');
      }

      const actualRole = (userRoleString ? String(userRoleString) : String(userRequesting.role)).toLowerCase();

      let hasPermission = false;
      const loggerSuffix = `curso ${id} por usuario ${userId} con rol ${actualRole}`;

      // 1. Super Admin?
      if (actualRole === UserRole.SUPER_ADMIN.toLowerCase() || actualRole === 'superadmin') {
        hasPermission = true;
      }

      // 2. Profesor del curso (principal o en la lista de profesores)?
      if (!hasPermission) {
        const isCourseTeacher = course.teacher.toString() === userId || 
                                (course.teachers && course.teachers.some(t => t.toString() === userId));
        if (isCourseTeacher) {
          hasPermission = true;
        }
      }

      // 3. School Owner o Administrative de la escuela del curso?
      if (!hasPermission && course.school && typeof course.school === 'object') {
        const school = course.school as School; // Usar el tipo School directamente si está bien importado y definido
        
        // Verificar School Owner (asumiendo que school.admin es el ObjectId del owner y el rol del usuario es school_owner)
        // O si el rol es ADMIN y es el admin de la escuela.
        if (school.admin && school.admin.toString() === userId && 
            (actualRole === UserRole.SCHOOL_OWNER.toLowerCase() || actualRole === UserRole.ADMIN.toLowerCase() )) {
          hasPermission = true;
        }

        // Verificar Administrative de la escuela (usando school.administratives)
        if (!hasPermission && actualRole === UserRole.ADMINISTRATIVE.toLowerCase()) {
          // Asegurarse que school.administratives es un array de ObjectId o strings
          if (school.administratives && school.administratives.some(adminUser => adminUser.toString() === userId)) {
            hasPermission = true;
          }
        }
      }

      if (!hasPermission) {
        this.logger.warn(`Intento DENEGADO de eliminar ${loggerSuffix}`);
        throw new UnauthorizedException('No tiene los permisos necesarios para eliminar este curso.');
      }
      
      this.logger.log(`Permiso CONCEDIDO. Eliminando ${loggerSuffix}`);
      // Eliminar el curso
      await this.courseModel.findByIdAndDelete(id);
      
      // Eliminar la referencia del curso en la escuela
      try {
        const schoolId = course.school.toString();
        await this.schoolsService.removeCourse(schoolId, id);
      } catch (error) {
        this.logger.error(`Error al eliminar referencia del curso en la escuela: ${error.message}`, error.stack);
        // No lanzamos excepción para no interrumpir la eliminación del curso
      }
      
      return { success: true, message: 'Curso eliminado exitosamente' };
    } catch (error) {
      this.logger.error(`Error al eliminar curso ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }

  async enrollStudent(courseId: string, studentId: string, userId: string): Promise<Enrollment> {
    const course = await this.courseModel.findById(courseId);
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const student = await this.userModel.findById(studentId);
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    // Obtener la escuela asociada al curso
    const schoolId = typeof course.school === 'object' && course.school !== null
      ? (course.school as any)._id?.toString() || String(course.school)
      : String(course.school);
    
    const school = await this.schoolModel.findById(schoolId);
    if (!school) {
      throw new NotFoundException('School not found');
    }

    // Check if enrollment already exists
    const existingEnrollment = await this.enrollmentModel.findOne({
      course: new Types.ObjectId(courseId),
      student: new Types.ObjectId(studentId),
    });

    if (existingEnrollment) {
      // Si el enrollment existe pero está inactivo, lo reactivamos
      if (!existingEnrollment.isActive) {
        existingEnrollment.isActive = true;
        existingEnrollment.updatedBy = new Types.ObjectId(userId) as any;
        await existingEnrollment.save();
        
        // 1. Agregar el estudiante al curso si no existe
        if (!course.students || !course.students.some(id => id.toString() === studentId)) {
          await this.courseModel.updateOne(
            { _id: courseId },
            { $addToSet: { students: new Types.ObjectId(studentId) } }
          );
          
        }

        // 2. Agregar el estudiante a la escuela si no existe
        if (!school.students || !school.students.some(id => id.toString() === studentId)) {
          await this.schoolModel.updateOne(
            { _id: schoolId },
            { $addToSet: { students: new Types.ObjectId(studentId) } }
          );
          
        }

        // 3. Asegurarnos que el curso esté en el array enrolledCourses del usuario
        if (!student.enrolledCourses.some(id => id.toString() === courseId)) {
          // Usar el tipo correcto para ObjectId
          student.enrolledCourses.push(new Types.ObjectId(courseId) as any);
        }
        
        // 4. Asegurarnos que la escuela esté en el array schools del usuario
        if (!student.schools || !student.schools.some(id => id.toString() === schoolId)) {
          if (!student.schools) student.schools = [];
          student.schools.push(new Types.ObjectId(schoolId) as any);
        }
        
        await student.save();
        
        return existingEnrollment;
      }
      
      throw new BadRequestException('Student already enrolled in this course');
    }

    // Crear nueva inscripción
    const enrollment = new this.enrollmentModel({
      course: new Types.ObjectId(courseId),
      student: new Types.ObjectId(studentId),
      paymentStatus: false,
      isActive: true,
      updatedBy: new Types.ObjectId(userId) as any,
    });

    // Guardar la inscripción
    const savedEnrollment = await enrollment.save();
    
    // Iniciar actualización de referencias en paralelo para mayor eficiencia
    const updatePromises = [];
    
    // 1. Actualizar el array students del curso
    if (!course.students || !course.students.some(id => id.toString() === studentId)) {
      updatePromises.push(
        this.courseModel.updateOne(
          { _id: courseId },
          { $addToSet: { students: new Types.ObjectId(studentId) } }
        ).then(() => {
          
        })
      );
    }
    
    // 2. Actualizar el array students de la escuela
    if (!school.students || !school.students.some(id => id.toString() === studentId)) {
      updatePromises.push(
        this.schoolModel.updateOne(
          { _id: schoolId },
          { $addToSet: { students: new Types.ObjectId(studentId) } }
        ).then(() => {
          
        })
      );
    }
    
    // 3. Actualizar el array enrolledCourses del usuario
    if (!student.enrolledCourses.some(id => id.toString() === courseId)) {
      // Usar el tipo correcto para ObjectId
      student.enrolledCourses.push(new Types.ObjectId(courseId) as any);
    }
    
    // 4. Actualizar el array schools del usuario (agregar la escuela)
    if (!student.schools || !student.schools.some(id => id.toString() === schoolId)) {
      if (!student.schools) student.schools = [];
      student.schools.push(new Types.ObjectId(schoolId) as any);
    }
    
            // Guardar los cambios del estudiante
        updatePromises.push(student.save());
    
    // Esperar a que todas las actualizaciones se completen
    try {
      await Promise.all(updatePromises);
    } catch (error) {
      this.logger.error(`Error actualizando referencias: ${error.message}`, error.stack);
      // No lanzar error para no interrumpir el flujo, el enrollment ya se guardó
    }

    return savedEnrollment;
  }

  async updateEnrollmentPaymentStatus(
    courseId: string, 
    studentId: string, 
    paymentStatus: boolean, 
    paymentNotes?: string,
    userId?: string
  ): Promise<Enrollment> {
    const enrollment = await this.enrollmentModel.findOne({
      course: new Types.ObjectId(courseId),
      student: new Types.ObjectId(studentId),
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    enrollment.paymentStatus = paymentStatus;
    
    if (paymentStatus) {
      enrollment.lastPaymentDate = new Date();
    }
    
    if (paymentNotes) {
      enrollment.paymentNotes = paymentNotes;
    }
    
    if (userId) {
      // Usar mongoose Types.ObjectId para la conversión correcta
      enrollment.updatedBy = new Types.ObjectId(userId) as any;
    }

    return enrollment.save();
  }

  async getEnrollmentsByStudent(studentId: string): Promise<Enrollment[]> {
    return this.enrollmentModel.find({ student: new Types.ObjectId(studentId) })
      .populate('course')
      .populate('student')
      .populate('updatedBy')
      .exec();
  }

  async getEnrollmentsByCourse(courseId: string): Promise<Enrollment[]> {
    return this.enrollmentModel.find({ course: new Types.ObjectId(courseId) })
      .populate('student')
      .populate('updatedBy')
      .exec();
  }

  async unenrollStudent(courseId: string, studentId: string, userId?: string): Promise<void> {
    // Buscar la inscripción
    const enrollment = await this.enrollmentModel.findOne({
      course: new Types.ObjectId(courseId),
      student: new Types.ObjectId(studentId),
    });

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // En lugar de eliminar, marcamos como inactivo para mantener el historial
    enrollment.isActive = false;
    
    // Si se proporciona userId, actualizar quién hizo el cambio
    if (userId) {
      enrollment.updatedBy = new Types.ObjectId(userId) as any;
    }
    
    await enrollment.save();
    
    // Buscar los objetos relacionados
    const [course, student] = await Promise.all([
      this.courseModel.findById(courseId),
      this.userModel.findById(studentId)
    ]);
    
    if (!course || !student) {
      throw new NotFoundException('Course or student not found');
    }
    
    // Obtener la escuela asociada al curso
    const schoolId = typeof course.school === 'object' && course.school !== null
      ? (course.school as any)._id?.toString() || String(course.school)
      : String(course.school);
    
    
    
    // Iniciar actualización de referencias en paralelo para mayor eficiencia
    const updatePromises = [];
    
    // 1. Eliminar el estudiante del array de estudiantes del curso
    updatePromises.push(
      this.courseModel.updateOne(
        { _id: courseId },
        { $pull: { students: new Types.ObjectId(studentId) } }
      )
    );
    
    // 2. Eliminar el curso del array enrolledCourses del usuario
          if (student.enrolledCourses && student.enrolledCourses.length > 0) {
        student.enrolledCourses = student.enrolledCourses.filter(
          id => id.toString() !== courseId
        );
        updatePromises.push(student.save());
      }
    
    // 3. Verificar si el estudiante está enrollado en otros cursos de la misma escuela
    const otherEnrollmentsInSameSchool = await this.enrollmentModel.find({
      student: new Types.ObjectId(studentId),
      isActive: true,
      _id: { $ne: enrollment._id } // Excluir el enrollment actual
    }).populate({
      path: 'course',
      match: { school: schoolId }
    });
    
          // Si no hay otros enrollments activos en cursos de esta escuela, eliminar al estudiante de la escuela
      if (!otherEnrollmentsInSameSchool.some(e => e.course)) {
        updatePromises.push(
          this.schoolModel.updateOne(
            { _id: schoolId },
            { $pull: { students: new Types.ObjectId(studentId) } }
          )
        );
      }
    
    // Esperar a que todas las actualizaciones se completen
    try {
      await Promise.all(updatePromises);
    } catch (error) {
      this.logger.error(`Error actualizando referencias: ${error.message}`, error.stack);
      // No lanzar error para no interrumpir el flujo, el enrollment ya se marcó como inactivo
    }
  }

  async getAllEnrollments(userId: string): Promise<Enrollment[]> {
    // Si es super_admin, devolver todas las inscripciones
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (compareRole(user.role, UserRole.SUPER_ADMIN)) {
      return this.enrollmentModel.find()
        .populate('student')
        .populate('course')
        .populate('updatedBy')
        .exec();
    }

    // Si es admin de escuela, devolver inscripciones de cursos de sus escuelas
    if (compareRole(user.role, UserRole.ADMIN) || compareRole(user.role, UserRole.SCHOOL_OWNER)) {
      // Obtener las escuelas administradas o propias
      const schoolIds = [
        ...user.administratedSchools, 
        ...user.ownedSchools
      ].map(id => new Types.ObjectId(id.toString()));

      // Obtener los cursos de esas escuelas
      const courses = await this.courseModel.find({
        school: { $in: schoolIds }
      });

      const courseIds = courses.map(course => new Types.ObjectId(course._id.toString()));

      // Obtener las inscripciones de esos cursos
      return this.enrollmentModel.find({
        course: { $in: courseIds }
      })
        .populate('student')
        .populate('course')
        .populate('updatedBy')
        .exec();
    }

    throw new UnauthorizedException('You do not have permission to view these enrollments');
  }

  async getEnrollmentById(enrollmentId: string, userId: string, userRole: string): Promise<Enrollment> {
    const enrollment = await this.enrollmentModel.findById(enrollmentId)
      .populate('student')
      .populate('course')
      .populate('updatedBy')
      .exec();

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Super admin puede ver cualquier inscripción
    if (compareRole(userRole, UserRole.SUPER_ADMIN)) {
      return enrollment;
    }

    // Si es un estudiante, solo puede ver su propia inscripción
    if (compareRole(userRole, UserRole.STUDENT)) {
      let studentId: string;
      try {
        const student = enrollment.student;
        if (typeof student === 'object' && student !== null) {
          studentId = student.toString();
        } else {
          studentId = String(student);
        }
      } catch (err) {
        this.logger.error(`Error processing student ID: ${err.message}`);
        studentId = String(enrollment.student);
      }
        
      if (studentId !== userId) {
        throw new UnauthorizedException('You can only view your own enrollments');
      }
      return enrollment;
    }

    // Verificar si el usuario tiene permisos para ver esta inscripción
    const course = await this.courseModel.findById(enrollment.course).populate('school');
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Si es profesor del curso
    if (compareRole(userRole, UserRole.TEACHER) && course.teacher.toString() === userId) {
      return enrollment;
    }

    // Si es admin de la escuela
    if ((compareRole(userRole, UserRole.ADMIN) || compareRole(userRole, UserRole.SCHOOL_OWNER)) && 
      (user.administratedSchools.some(id => id.toString() === (course.school && typeof course.school === 'object' ? course.school.toString() : String(course.school))) ||
        user.ownedSchools.some(id => id.toString() === (course.school && typeof course.school === 'object' ? course.school.toString() : String(course.school))))) {
      return enrollment;
    }

    throw new UnauthorizedException('You do not have permission to view this enrollment');
  }

  async updateEnrollment(
    enrollmentId: string, 
    updateEnrollmentDto: any, 
    userId: string, 
    userRole: string
  ): Promise<Enrollment> {
    const enrollment = await this.enrollmentModel.findById(enrollmentId);
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Verificar permisos
    const course = await this.courseModel.findById(enrollment.course).populate('school');
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let hasPermission = false;

    // Super admin tiene permiso
    if (compareRole(user.role, UserRole.SUPER_ADMIN)) {
      hasPermission = true;
    }
    // Profesor del curso tiene permiso
    else if (compareRole(userRole, UserRole.TEACHER) && course.teacher.toString() === userId) {
      hasPermission = true;
    }
    // Admin de la escuela tiene permiso
    else if (
      (compareRole(user.role, UserRole.ADMIN) || compareRole(user.role, UserRole.SCHOOL_OWNER)) && 
      (user.administratedSchools.some(id => id.toString() === (course.school && typeof course.school === 'object' ? course.school.toString() : String(course.school))) ||
       user.ownedSchools.some(id => id.toString() === (course.school && typeof course.school === 'object' ? course.school.toString() : String(course.school))))) {
      hasPermission = true;
    }

    if (!hasPermission) {
      throw new UnauthorizedException('You do not have permission to update this enrollment');
    }

    // Actualizar fecha de pago si se está cambiando el estado de pago a true
    if (updateEnrollmentDto.paymentStatus === true && !enrollment.paymentStatus) {
      updateEnrollmentDto.lastPaymentDate = new Date();
    }

    // Actualizar inscripción
    return this.enrollmentModel.findByIdAndUpdate(
      enrollmentId,
      { ...updateEnrollmentDto, updatedBy: new Types.ObjectId(userId) as any },
      { new: true }
    )
      .populate('student')
      .populate('course')
      .populate('updatedBy')
      .exec();
  }

  async removeEnrollment(enrollmentId: string, userId: string): Promise<{ success: boolean; message: string }> {
    const enrollment = await this.enrollmentModel.findById(enrollmentId);
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    // Verificar permisos
    const course = await this.courseModel.findById(enrollment.course).populate('school');
    if (!course) {
      throw new NotFoundException('Course not found');
    }

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let hasPermission = false;

    // Super admin tiene permiso
    if (compareRole(user.role, UserRole.SUPER_ADMIN)) {
      hasPermission = true;
    }
    // Admin de la escuela tiene permiso
    else if (
      (compareRole(user.role, UserRole.ADMIN) || compareRole(user.role, UserRole.SCHOOL_OWNER)) && 
      (user.administratedSchools.some(id => id.toString() === (course.school && typeof course.school === 'object' ? course.school.toString() : String(course.school))) ||
       user.ownedSchools.some(id => id.toString() === (course.school && typeof course.school === 'object' ? course.school.toString() : String(course.school))))) {
      hasPermission = true;
    }

    if (!hasPermission) {
      throw new UnauthorizedException('You do not have permission to delete this enrollment');
    }

    // Eliminar la inscripción
    await this.enrollmentModel.findByIdAndDelete(enrollmentId);

    // Eliminar la referencia en el estudiante
    const student = await this.userModel.findById(enrollment.student);
    if (student) {
      student.enrolledCourses = student.enrolledCourses.filter(
        courseId => courseId.toString() !== course._id.toString()
      );
      await student.save();
    }

    return { success: true, message: 'Enrollment deleted successfully' };
  }

  async getTeachingCourses(userId: string, userRole: string) {
    try {
      let courses;
      
      // If the user is a super admin or admin, they can see all courses
      if (compareRole(userRole, UserRole.SUPER_ADMIN) || compareRole(userRole, UserRole.ADMIN)) {
        courses = await this.courseModel.find()
          .populate('school', 'name')
          .populate('teacher', 'name email')
          .select('-students -classes');
      } else {
        // For teachers, only return courses they teach
        courses = await this.courseModel.find({ teacher: userId })
          .populate('school', 'name')
          .populate('teacher', 'name email')
          .select('-students -classes');
      }
      
      return courses;
    } catch (error) {
      this.logger.error(`Error getting teaching courses: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getEnrolledCourses(userId: string) {
    try {
      // Get all enrollments for this student (only active ones)
      const enrollments = await this.enrollmentModel.find({ 
        student: new Types.ObjectId(userId),
        isActive: true
      });
      
      if (!enrollments || enrollments.length === 0) {
        return [];
      }
      
      // Log enrollments details for debugging
      enrollments.forEach((enrollment, index) => {
        console.log({
          id: enrollment._id.toString(),
          courseId: enrollment.course.toString(),
          isActive: enrollment.isActive,
          paymentStatus: enrollment.paymentStatus
        });
      });
      
      // Extract course IDs from enrollments
      const courseIds = enrollments.map(enrollment => 
        enrollment.course instanceof Types.ObjectId 
          ? enrollment.course 
          : new Types.ObjectId(enrollment.course.toString())
      );
      
      // Get the courses
      const courses = await this.courseModel.find({
        _id: { $in: courseIds }
      })
        .populate('school', 'name')
        .populate('teacher', 'name email')
        .select('-students -classes');
      
      // Registrar los IDs de los cursos encontrados
      if (courses.length > 0) {
        // Courses found
      }
      
      // Add enrollment dates to courses
      const coursesWithEnrollmentDates = courses.map(course => {
        const enrollment = enrollments.find(e => e.course.toString() === course._id.toString());
        const courseObj = course.toObject();
        if (enrollment) {
          courseObj.createdAt = enrollment['createdAt'] || enrollment['_doc']?.createdAt;
        }
        return courseObj;
      });
      
      return coursesWithEnrollmentDates;
    } catch (error) {
      this.logger.error(`Error getting enrolled courses: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getCourseForUser(id: string, userId?: string, userRole?: string, includeSchedule = false) {
    try {
      const course = await this.courseModel.findById(id)
        .populate('teacher', 'name email')
        .populate('teachers', 'name email')
        .populate('school', 'name logoUrl')
        .populate('students', 'name email status')
        .populate({
          path: 'classes',
          options: { sort: { order: 1 } }
        })
        .lean();

      if (!course) {
        throw new NotFoundException(`Curso con ID ${id} no encontrado`);
      }

      const normalizedRole = userRole ? String(userRole).toLowerCase() : null;

      // Add schedule data if requested
      let schedule = null;
      if (includeSchedule) {
        try {
          schedule = await this.courseScheduleService.getSchedule(id);
        } catch (error) {
          this.logger.debug(`No schedule found for course ${id}`);
        }
      }

      const adminRoles = ['super_admin', 'superadmin', 'school_owner', 'administrative', 'admin'];
      if (normalizedRole && adminRoles.includes(normalizedRole)) {
        return {
          ...course,
          schedule,
          classes: Array.isArray(course.classes) ? (course.classes as any[]).map(c => ({ ...c, isVisible: true })) : []
        };
      }

      const isCourseTeacher = normalizedRole === 'teacher' && userId && (
        (course.teacher && (course.teacher as any)._id && (course.teacher as any)._id.toString() === userId) || // Comparar _id si teacher está populado
        (course.teacher && !(course.teacher as any)._id && course.teacher.toString() === userId) || // Comparar directamente si teacher es solo ObjectId
        (course.teachers && course.teachers.some(t => {
          if (!t) return false;
          if ((t as any)._id) return (t as any)._id.toString() === userId; // Si t está populado
          return t.toString() === userId; // Si t es solo ObjectId
        }))
      );
      if (isCourseTeacher) {
        return {
          ...course,
          schedule,
          classes: Array.isArray(course.classes) ? (course.classes as any[]).map(c => ({ ...c, isVisible: true })) : []
        };
      }

      const isEnrolledStudent = userId && course.students &&
        course.students.some(sId => sId && sId.toString() === userId);
      if (isEnrolledStudent) {
        return {
          ...course,
          schedule,
          classes: Array.isArray(course.classes) ? (course.classes as any[]).map(c => ({ ...c, isVisible: true })) : []
        };
      }

      if (course.isPublic) {
        const allClassVisible = !!userId;
        return {
          ...course,
          schedule,
          classes: Array.isArray(course.classes) ? (course.classes as any[]).map((c, index) => ({
            ...c,
            isVisible: allClassVisible || index === 0 || (c && c.isPublic === true)
          })) : []
        };
      }

      this.logger.warn(`[getCourseForUser] ACCESO DENEGADO FINAL. Curso ID: ${id}, Usuario ID: ${userId}, Rol: ${normalizedRole}`);
      throw new UnauthorizedException('No tienes permiso para ver este curso o requiere autenticación.');
    } catch (error) {
      this.logger.error(`[getCourseForUser] ERROR EXCEPCION. Curso ID: ${id}, Error: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException('Ocurrió un error al procesar tu solicitud.');
    }
  }

  // Añadir una nueva función para registrar un pago mensual
  async addPaymentToEnrollment(
    enrollmentId: string,
    paymentData: {
      amount: number;
      notes?: string;
      month?: string;
    },
    userId: string
  ): Promise<Enrollment> {
    // Buscar la inscripción
    const enrollment = await this.enrollmentModel.findById(enrollmentId);
    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }
    
    // Si la inscripción estaba inactiva, reactivarla
    const wasInactive = !enrollment.isActive;
    enrollment.isActive = true;
    
    // Crear nuevo registro de pago
    const newPayment = {
      date: new Date(),
      amount: paymentData.amount,
      notes: paymentData.notes || '',
      month: paymentData.month || this.getCurrentMonthAsString(),
      registeredBy: new Types.ObjectId(userId) as any
    };
    
    // Añadir al historial de pagos
    enrollment.paymentHistory.push(newPayment);
    
    // Actualizar estado de pago general
    enrollment.paymentStatus = true;
    enrollment.lastPaymentDate = new Date();
    enrollment.updatedBy = new Types.ObjectId(userId) as any;
    
    if (paymentData.notes) {
      enrollment.paymentNotes = paymentData.notes;
    }
    
    // Guardar cambios en la inscripción
    const savedEnrollment = await enrollment.save();
    
    // Si la inscripción estaba inactiva, necesitamos actualizar referencias
    if (wasInactive) {
      const courseId = enrollment.course.toString();
      const studentId = enrollment.student.toString();
      
      try {
        // Buscar los objetos relacionados
        const [course, student] = await Promise.all([
          this.courseModel.findById(courseId),
          this.userModel.findById(studentId)
        ]);
        
        if (!course || !student) {
          throw new NotFoundException('Course or student not found');
        }
        
        // Obtener la escuela asociada al curso
        const schoolId = typeof course.school === 'object' && course.school !== null
          ? (course.school as any)._id?.toString() || String(course.school)
          : String(course.school);
          
        const school = await this.schoolModel.findById(schoolId);
        if (!school) {
          throw new NotFoundException('School not found');
        }
        
        // Iniciar actualización de referencias en paralelo
        const updatePromises = [];
        
        // 1. Agregar el estudiante al curso si no existe
        if (!course.students || !course.students.some(id => id.toString() === studentId)) {
          updatePromises.push(
            this.courseModel.updateOne(
              { _id: courseId },
              { $addToSet: { students: new Types.ObjectId(studentId) } }
            )
          );
        }
        
        // 2. Agregar el estudiante a la escuela si no existe
        if (!school.students || !school.students.some(id => id.toString() === studentId)) {
          updatePromises.push(
            this.schoolModel.updateOne(
              { _id: schoolId },
              { $addToSet: { students: new Types.ObjectId(studentId) } }
            )
          );
        }
        
        // 3. Asegurarnos que el curso esté en el array enrolledCourses del usuario
        if (!student.enrolledCourses.some(id => id.toString() === courseId)) {
          student.enrolledCourses.push(new Types.ObjectId(courseId) as any);
        }
        
        // 4. Asegurarnos que la escuela esté en el array schools del usuario
        if (!student.schools || !student.schools.some(id => id.toString() === schoolId)) {
          if (!student.schools) student.schools = [];
          student.schools.push(new Types.ObjectId(schoolId) as any);
        }
        
        updatePromises.push(
          student.save().then(() => {
            
          })
        );
        
        // Esperar a que todas las actualizaciones se completen
        await Promise.all(updatePromises);
        
      } catch (error) {
        this.logger.error(`Error actualizando referencias al reactivar enrollment: ${error.message}`, error.stack);
        // No lanzar error para no interrumpir el flujo, el pago ya se registró
      }
    }
    
    return savedEnrollment;
  }

  // Create enrollment for payment if student exists in course but has no enrollment record
  async createEnrollmentForPayment(courseId: string, studentId: string, userId: string): Promise<any> {
    try {
      // Verificar que el curso existe
      const course = await this.courseModel.findById(courseId);
      if (!course) {
        this.logger.error(`Course not found: ${courseId}`);
        return null;
      }

      // Verificar que el estudiante existe
      const student = await this.userModel.findById(studentId);
      if (!student) {
        this.logger.error(`Student not found: ${studentId}`);
        return null;
      }

      // Verificar que el estudiante está asociado al curso
      const isStudentInCourse = course.students && course.students.some(s => s.toString() === studentId);
      const isStudentEnrolled = student.enrolledCourses && student.enrolledCourses.some(c => c.toString() === courseId);
      
      if (!isStudentInCourse && !isStudentEnrolled) {
        this.logger.error(`Student ${studentId} is not associated with course ${courseId}`);
        return null;
      }



      // Crear el enrollment
      const enrollment = new this.enrollmentModel({
        course: new Types.ObjectId(courseId),
        student: new Types.ObjectId(studentId),
        paymentStatus: false,
        isActive: true,
        updatedBy: new Types.ObjectId(userId) as any,
      });

      const savedEnrollment = await enrollment.save();
      
      // Asegurar que el estudiante esté en el array de estudiantes del curso
      if (!isStudentInCourse) {
        await this.courseModel.updateOne(
          { _id: courseId },
          { $addToSet: { students: new Types.ObjectId(studentId) } }
        );
      }

      // Asegurar que el curso esté en el array de cursos inscritos del estudiante
      if (!isStudentEnrolled) {
        await this.userModel.updateOne(
          { _id: studentId },
          { $addToSet: { enrolledCourses: new Types.ObjectId(courseId) } }
        );
      }


      return savedEnrollment;

    } catch (error) {
      this.logger.error(`Error creating enrollment for payment: ${error.message}`, error.stack);
      return null;
    }
  }

  // Helper para obtener el mes actual en formato YYYY-MM
  private getCurrentMonthAsString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  async getUnpaidStudents(courseId: string, month: number, year: number, userId: string, userRole: string) {
    // Verify user has access to this course
    const course = await this.getCourseForUser(courseId, userId, userRole);
    if (!course) {
      throw new NotFoundException('Course not found or access denied');
    }

    // Get all enrollments for this course
    const enrollments = await this.enrollmentModel.find({
      course: courseId,
      isActive: true
    }).populate('student', 'name email');

    // Format target month for comparison
    const targetMonth = `${year}-${String(month).padStart(2, '0')}`;

    // Separate students into paid and unpaid
    const paidStudents = [];
    const unpaidStudents = [];

    enrollments.forEach(enrollment => {
      const studentData = enrollment.student as any;
      const studentId = studentData._id.toString();
      const studentName = studentData.name || 'N/A';
      
      const hasPaymentForMonth = enrollment.paymentHistory.some(payment => {
        const paymentMonth = payment.month;
        const matches = paymentMonth === targetMonth;
        return matches;
      });

      const studentInfo = {
        studentId: studentData._id.toString(),
        studentName: studentData.name || 'N/A',
        studentEmail: studentData.email || 'N/A',
        month: targetMonth
      };

      if (hasPaymentForMonth) {
        paidStudents.push(studentInfo);
      } else {
        unpaidStudents.push(studentInfo);
      }
    });

    return {
      courseId,
      courseName: course.title,
      month,
      year,
      targetMonth,
      totalStudents: enrollments.length,
      paidCount: paidStudents.length,
      unpaidCount: unpaidStudents.length,
      paidStudents,
      unpaidStudents
    };
  }

  /**
   * Método de migración para inicializar los campos de promoción en cursos existentes
   * Debe ser ejecutado manualmente una vez después de actualizar el esquema
   */
  async migrateExistingCourses(): Promise<{ success: boolean, message: string, updatedCount: number }> {
    this.logger.log('Iniciando migración para agregar campos de promoción a cursos existentes');
    
    try {
      // Verificar cuántos cursos no tienen el campo promotionOrder
      const coursesWithoutPromoFields = await this.courseModel.countDocuments({
        $or: [
          { promotionOrder: { $exists: false } },
          { isFeatured: { $exists: false } }
        ]
      });
      
      this.logger.log(`Encontrados ${coursesWithoutPromoFields} cursos sin campos de promoción`);
      
      if (coursesWithoutPromoFields === 0) {
        return { 
          success: true, 
          message: 'Todos los cursos ya tienen los campos de promoción', 
          updatedCount: 0 
        };
      }
      
      // Actualizar todos los cursos que no tienen los campos para asignarles valores por defecto
      const updateResult = await this.courseModel.updateMany(
        {
          $or: [
            { promotionOrder: { $exists: false } },
            { isFeatured: { $exists: false } }
          ]
        },
        {
          $set: {
            promotionOrder: 999,  // Valor por defecto (baja prioridad)
            isFeatured: false     // No destacado por defecto
          }
        }
      );
      
      this.logger.log(`Migración completada. Actualizados ${updateResult.modifiedCount} cursos`);
      
      return {
        success: true,
        message: 'Migración completada exitosamente',
        updatedCount: updateResult.modifiedCount
      };
    } catch (error) {
      this.logger.error(`Error en la migración: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Error en la migración: ${error.message}`,
        updatedCount: 0
      };
    }
  }

  async getPaymentHistoryForMonth(courseId: string, studentId: string, month: string, userId: string) {
    try {

      // Verify user has access to this course
      const course = await this.getCourseForUser(courseId, userId, null);
      if (!course) {
        throw new NotFoundException('Course not found or access denied');
      }

      // Find the enrollment
      const enrollment = await this.enrollmentModel.findOne({
        course: new Types.ObjectId(courseId),
        student: new Types.ObjectId(studentId),
      }).populate('student', 'name email');

      if (!enrollment) {
        return {
          payments: [],
          totalPaid: 0,
          studentName: 'Unknown',
          month: month,
          courseTitle: course.title
        };
      }

      // Filter payments for the specified month
      const monthPayments = enrollment.paymentHistory.filter(payment => payment.month === month);

      // Calculate total paid for this month
      const totalPaid = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);

      // Sort payments by date (newest first)
      const sortedPayments = monthPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const result = {
        payments: sortedPayments.map((payment, index) => {
          const paymentDoc = payment as any;
          
          // For consistent IDs, use a hash based on IMMUTABLE payment data
          // DO NOT include amount or notes since they can be updated
          // Use date timestamp and month to ensure uniqueness and consistency
          const crypto = require('crypto');
          const paymentDataString = `${payment.date.getTime()}-${payment.month}`;
          const consistentId = crypto.createHash('md5').update(paymentDataString).digest('hex').substring(0, 24);
          

          
          return {
            _id: consistentId,
            amount: payment.amount,
            date: payment.date,
            notes: payment.notes,
            month: payment.month
          };
        }),
        totalPaid,
        studentName: (enrollment.student as any).name || 'Unknown',
        studentEmail: (enrollment.student as any).email || 'Unknown',
        month: month,
        courseTitle: course.title
      };

      return result;

    } catch (error) {
      this.logger.error(`Error getting payment history: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updatePayment(
    courseId: string, 
    studentId: string, 
    paymentId: string, 
    updateData: { amount: number; notes?: string }, 
    userId: string
  ) {
    try {

      
      // Verify user has access to this course
      const course = await this.getCourseForUser(courseId, userId, null);
      if (!course) {
        throw new NotFoundException('Course not found or access denied');
      }

      // Find the enrollment
      const enrollment = await this.enrollmentModel.findOne({
        course: new Types.ObjectId(courseId),
        student: new Types.ObjectId(studentId),
      });

      if (!enrollment) {
        throw new NotFoundException('Enrollment not found');
      }

      const crypto = require('crypto');
      
      let payment = null;
      let paymentIndex = -1;
      
      enrollment.paymentHistory.forEach((p, idx) => {
        const paymentDataString = `${p.date.getTime()}-${p.month}`;
        const consistentId = crypto.createHash('md5').update(paymentDataString).digest('hex').substring(0, 24);
        
        if (consistentId === paymentId) {
          payment = p;
          paymentIndex = idx;
        }
      });
      
      if (!payment) {
        this.logger.error(`Payment with ID ${paymentId} not found in enrollment ${enrollment._id}`);
        throw new NotFoundException('Payment not found. Please refresh the payment list and try again.');
      }
      

      payment.amount = updateData.amount;
      if (updateData.notes !== undefined) {
        payment.notes = updateData.notes;
      }

      await enrollment.save();
      return { message: 'Payment updated successfully' };
    } catch (error) {
      this.logger.error(`Error updating payment: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deletePayment(courseId: string, studentId: string, paymentId: string, userId: string) {
    try {

      
      // Verify user has access to this course
      const course = await this.getCourseForUser(courseId, userId, null);
      if (!course) {
        throw new NotFoundException('Course not found or access denied');
      }

      // Find the enrollment
      const enrollment = await this.enrollmentModel.findOne({
        course: new Types.ObjectId(courseId),
        student: new Types.ObjectId(studentId),
      });

      if (!enrollment) {
        throw new NotFoundException('Enrollment not found');
      }

      const crypto = require('crypto');
      
      let payment = null;
      let paymentIndex = -1;
      
      enrollment.paymentHistory.forEach((p, idx) => {
        const paymentDataString = `${p.date.getTime()}-${p.month}`;
        const consistentId = crypto.createHash('md5').update(paymentDataString).digest('hex').substring(0, 24);
        
        if (consistentId === paymentId) {
          payment = p;
          paymentIndex = idx;
        }
      });

      if (!payment) {
        this.logger.error(`Payment with ID ${paymentId} not found in enrollment ${enrollment._id}`);
        throw new NotFoundException('Payment not found. Please refresh the payment list and try again.');
      }

      // Remove the payment by index
      enrollment.paymentHistory.splice(paymentIndex, 1);
      await enrollment.save();
      
      return { message: 'Payment deleted successfully' };
    } catch (error) {
      this.logger.error(`Error deleting payment: ${error.message}`, error.stack);
      throw error;
    }
  }
} 