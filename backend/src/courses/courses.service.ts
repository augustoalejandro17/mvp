import { Injectable, NotFoundException, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Course } from './schemas/course.schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { User } from '../auth/schemas/user.schema';
import { UserRole } from '../auth/enums/user-role.enum';
import { SchoolsService } from '../schools/schools.service';
import { Enrollment } from './schemas/enrollment.schema';
import { School } from '../schools/schemas/school.schema';

// Función de utilidad para comparar roles
const compareRole = (userRole: any, enumRole: UserRole): boolean => {
  // Si los roles son directamente iguales (mismo enum)
  if (userRole === enumRole) return true;
  
  // Si no, comparamos los valores como strings para evitar problemas de tipos distintos
  const userRoleStr = String(userRole).toLowerCase();
  const enumRoleStr = String(enumRole).toLowerCase();
  
  return userRoleStr === enumRoleStr;
};

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Enrollment.name) private enrollmentModel: Model<Enrollment>,
    private schoolsService: SchoolsService,
  ) {}

  async create(createCourseDto: CreateCourseDto, teacherId: string): Promise<Course> {
    
    
    console.log('Datos para crear curso:', JSON.stringify(createCourseDto));
    
    try {
      // Verificar que la escuela exista
      const school = await this.schoolModel.findById(createCourseDto.schoolId);
      if (!school) {
        throw new BadRequestException(`La escuela con ID ${createCourseDto.schoolId} no existe`);
      }
      
      // Configurar profesor principal (puede ser el que se proporciona en el DTO o el usuario actual)
      const mainTeacherId = createCourseDto.teacher || teacherId;
      
      // Verificar que el profesor principal exista
      const mainTeacher = await this.userModel.findById(mainTeacherId);
      if (!mainTeacher) {
        throw new BadRequestException(`El profesor principal con ID ${mainTeacherId} no existe`);
      }
      
      // Procesar lista de profesores adicionales
      let teachersArray = [mainTeacherId]; // Incluir profesor principal como el primer profesor
      
      // Si se proporcionaron profesores adicionales
      if (createCourseDto.teachers && createCourseDto.teachers.length > 0) {
        // Verificar que no exceda el límite de 5 profesores
        if (createCourseDto.teachers.length > 4) { // 4 + 1 principal = 5 total
          throw new BadRequestException('Un curso no puede tener más de 5 profesores');
        }
        
        // Verificar que los profesores existan y eliminar duplicados
        const uniqueTeachers = new Set<string>([mainTeacherId]);
        
        for (const teacherId of createCourseDto.teachers) {
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
        title: createCourseDto.title,
        description: createCourseDto.description,
        coverImageUrl: createCourseDto.coverImageUrl,
        isPublic: createCourseDto.isPublic || false,
        school: createCourseDto.schoolId,
        teacher: mainTeacherId, // Profesor principal (para compatibilidad)
        teachers: teachersArray // Array de profesores
      });
      
      
      
      const result = await createdCourse.save();
      console.log('Curso guardado exitosamente:', result);
      
      // Añadir el curso a la escuela
      
      try {
        await this.schoolsService.addCourse(createCourseDto.schoolId, String(result._id));
        console.log(`Curso añadido exitosamente a la escuela ${createCourseDto.schoolId}`);
      } catch (error) {
        this.logger.error(`Error al añadir curso a escuela: ${error.message}`, error.stack);
        console.error('Error al añadir curso a escuela:', error);
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
      
      return result;
    } catch (error) {
      console.error('Error al crear curso:', error);
      this.logger.error(`Error al crear curso: ${error.message}`, error.stack);
      throw error;
    }
  }

  async findAll(userId?: string, role?: UserRole | string, schoolId?: string) {
    
    
    
    try {
      let query: any = {};
      
      // Si se especifica una escuela, filtramos por ella
      if (schoolId) {
        query.school = schoolId;
      }
      
      // Normalize role for comparison
      const roleStr = String(role).toLowerCase();
      
      // Super admins pueden ver todos los cursos
      if (roleStr === 'super_admin') {
        
        // No aplicamos ningún filtro adicional para super_admin
      }
      // Los usuarios admin también pueden ver todos los cursos
      else if (roleStr === 'admin') {
        
        // No aplicamos ningún filtro adicional para admin
      }
      // Para otros roles, filtramos por cursos públicos o donde esté asociado
      else if (userId) {
        if (roleStr === 'teacher') {
          query = { 
            ...query,
            $or: [
              { isPublic: true },
              { teacher: userId }
            ] 
          };
        } else {
          query = { 
            ...query,
            $or: [
              { isPublic: true },
              { students: userId }
            ] 
          };
        }
      }
      
      
      
      const courses = await this.courseModel.find(query)
        .populate('school', 'name')
        .populate('teacher', 'name email')
        .select('-students -classes');
      
      
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

  async update(id: string, updateCourseDto: any, userId: string) {
    
    try {
      const course = await this.courseModel.findById(id);
      
      if (!course) {
        
        throw new NotFoundException(`Curso con ID ${id} no encontrado`);
      }
      
      // Verificar permisos
      if (course.teacher.toString() !== userId) {
        const user = await this.userModel.findById(userId);
        if (!user || !compareRole(user.role, UserRole.ADMIN)) {
          throw new BadRequestException('No tiene permisos para actualizar este curso');
        }
      }
      
      const updatedCourse = await this.courseModel.findByIdAndUpdate(
        id,
        updateCourseDto,
        { new: true }
      );
      
      
      return updatedCourse;
    } catch (error) {
      this.logger.error(`Error al actualizar curso ${id}: ${error.message}`, error.stack);
      throw error;
    }
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

  async remove(id: string, userId: string) {
    
    try {
      const course = await this.courseModel.findById(id);
      
      if (!course) {
        
        throw new NotFoundException(`Curso con ID ${id} no encontrado`);
      }
      
      // Verificar permisos (profesor del curso o admin)
      const isTeacher = course.teacher.toString() === userId;
      
      if (!isTeacher) {
        const user = await this.userModel.findById(userId);
        if (!user || !compareRole(user.role, UserRole.ADMIN)) {
          
          throw new UnauthorizedException('No tiene permisos para eliminar este curso');
        }
      }
      
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
          await student.save();
          
        }
        
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
      updatePromises.push(
        student.save().then(() => {
          
        })
      );
    }
    
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
      ).then(() => {
        
      })
    );
    
    // 2. Eliminar el curso del array enrolledCourses del usuario
    if (student.enrolledCourses && student.enrolledCourses.length > 0) {
      student.enrolledCourses = student.enrolledCourses.filter(
        id => id.toString() !== courseId
      );
      updatePromises.push(
        student.save().then(() => {
          
        })
      );
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
        ).then(() => {
          
        })
      );
    } else {
      
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

  async getCourseForUser(id: string, userId: string, userRole: string) {
    
    try {
      // Obtener el curso
      const course = await this.findOne(id);
      
      // Si el usuario es SUPER_ADMIN, permitir acceso completo a todas las clases
      if (compareRole(userRole, UserRole.SUPER_ADMIN)) {
        return {
          ...course,
          classes: Array.isArray(course.classes) ? course.classes.map(classItem => ({
            ...classItem,
            isVisible: true
          })) : []
        };
      }
      
      // Si el usuario es el profesor del curso, mostrar todas las clases
      let teacherId = null;
      try {
        if (course.teacher) {
          // Handle different types of teacher objects from MongoDB
          if (typeof course.teacher === 'object' && course.teacher !== null) {
            // Using string access to avoid TypeScript property errors
            teacherId = course.teacher['_id']?.toString() || null;
          } else {
            teacherId = String(course.teacher);
          }
        }
      } catch (error) {
        
      }
      
      if (teacherId === userId) {
        return {
          ...course,
          classes: Array.isArray(course.classes) ? course.classes.map(classItem => ({
            ...classItem,
            isVisible: true
          })) : []
        };
      }
      
      // Para otros usuarios, mantener la visibilidad definida en findOne
      return course;
    } catch (error) {
      this.logger.error(`Error getting course for user: ${error.message}`, error.stack);
      throw error;
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
    await enrollment.save();
    
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
            ).then(() => {
              
            })
          );
        }
        
        // 2. Agregar el estudiante a la escuela si no existe
        if (!school.students || !school.students.some(id => id.toString() === studentId)) {
          updatePromises.push(
            this.schoolModel.updateOne(
              { _id: schoolId },
              { $addToSet: { students: new Types.ObjectId(studentId) } }
            ).then(() => {
              
            })
          );
        }
        
        // 3. Asegurarnos que el curso esté en el array enrolledCourses del usuario
        if (!student.enrolledCourses.some(id => id.toString() === courseId)) {
          student.enrolledCourses.push(new Types.ObjectId(courseId) as any);
          updatePromises.push(
            student.save().then(() => {
              
            })
          );
        }
        
        // Esperar a que todas las actualizaciones se completen
        await Promise.all(updatePromises);
        
        
      } catch (error) {
        this.logger.error(`Error actualizando referencias al reactivar enrollment: ${error.message}`, error.stack);
        // No lanzar error para no interrumpir el flujo, el pago ya se registró
      }
    }
    
    
    
    return enrollment;
  }

  // Helper para obtener el mes actual en formato YYYY-MM
  private getCurrentMonthAsString(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
} 