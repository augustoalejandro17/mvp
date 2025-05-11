import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserRole } from '../schemas/user.schema';
import { School } from '../../schools/schemas/school.schema';
import { Course } from '../../courses/schemas/course.schema';
import { Logger } from '@nestjs/common';
import { Types as MongooseTypes } from 'mongoose';
import * as mongoose from 'mongoose';

@Injectable()
export class AuthorizationService {
  private readonly logger = new Logger(AuthorizationService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
  ) {}

  /**
   * Verifica si un usuario tiene permisos de super admin
   */
  isSuperAdmin(user: User): boolean {
    return user.role === UserRole.SUPER_ADMIN;
  }

  /**
   * Obtiene el rol de un usuario en una escuela específica
   * @param userId ID del usuario
   * @param schoolId ID de la escuela
   * @returns El rol del usuario en la escuela, o null si no tiene un rol específico
   */
  async getUserRoleInSchool(userId: string, schoolId: string): Promise<string | null> {
    if (!userId || !schoolId) return null;
    
    const user = await this.userModel.findById(userId);
    if (!user) return null;
    
    // Si es super admin, siempre tiene ese rol en cualquier contexto
    if (String(user.role).toLowerCase() === UserRole.SUPER_ADMIN.toLowerCase()) {
      return UserRole.SUPER_ADMIN;
    }
    
    // Buscar en schoolRoles
    const schoolRole = user.schoolRoles?.find(
      sr => sr.schoolId && sr.schoolId.toString() === schoolId
    );
    
    if (schoolRole) {
      return schoolRole.role;
    }
    
    // Si no tiene un rol específico pero es dueño de la escuela
    const isOwner = user.ownedSchools?.some(id => id.toString() === schoolId);
    if (isOwner) {
      return UserRole.SCHOOL_OWNER;
    }
    
    // Si no tiene un rol específico pero es administrador de la escuela
    const isAdmin = user.administratedSchools?.some(id => id.toString() === schoolId);
    if (isAdmin) {
      return UserRole.ADMIN;
    }
    
    // Si está en la escuela pero sin rol específico, es estudiante
    const isInSchool = user.schools?.some(id => id.toString() === schoolId);
    if (isInSchool) {
      return UserRole.STUDENT;
    }
    
    return null;
  }

  /**
   * Verifica si un usuario es dueño de una escuela específica
   */
  async isSchoolOwner(userId: string, schoolId: string): Promise<boolean> {
    if (!userId || !schoolId) return false;
    
    const user = await this.userModel.findById(userId);
    if (!user) return false;
    
    // Super admin tiene acceso a todas las escuelas
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    // Verificar rol específico en la escuela
    const schoolRole = await this.getUserRoleInSchool(userId, schoolId);
    if (schoolRole === UserRole.SCHOOL_OWNER) return true;
    
    // Verificar si el usuario es dueño de la escuela (compatibilidad con el modelo anterior)
    return user.role === UserRole.SCHOOL_OWNER && 
           user.ownedSchools.some(id => id.toString() === schoolId);
  }

  /**
   * Verifica si un usuario es administrador de una escuela específica
   */
  async isSchoolAdmin(userId: string, schoolId: string): Promise<boolean> {
    if (!userId || !schoolId) {
      return false;
    }
    
    
    const user = await this.userModel.findById(userId);
    if (!user) {
      return false;
    }
    
    // Super admin siempre tiene permisos administrativos
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }
    
    // Verificar rol específico en la escuela
    const schoolRole = await this.getUserRoleInSchool(userId, schoolId);
    if (schoolRole === UserRole.SCHOOL_OWNER || schoolRole === UserRole.ADMIN) {
      return true;
    }
    
    // Para compatibilidad con el modelo anterior
    if (user.role === UserRole.SCHOOL_OWNER && user.ownedSchools.some(id => id.toString() === schoolId)) {
      return true;
    }
    
    if (user.role === UserRole.ADMIN && user.administratedSchools.some(id => id.toString() === schoolId)) {
      return true;
    }
    
    return false;
  }

  /**
   * Verifica si un usuario es profesor de un curso específico
   */
  async isCourseTeacher(userId: string, courseId: string): Promise<boolean> {
    if (!userId || !courseId) return false;
    
    const user = await this.userModel.findById(userId);
    if (!user) return false;
    
    // Super admin tiene acceso a todos los cursos
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    // Verificar si el usuario es profesor del curso
    const isTeacher = user.teachingCourses.some(id => id.toString() === courseId);
    if (isTeacher) return true;
    
    // Verificar si es admin o dueño de la escuela a la que pertenece el curso
    const course = await this.courseModel.findById(courseId);
    if (!course) return false;
    
    const schoolId = course.school.toString();
    const schoolRole = await this.getUserRoleInSchool(userId, schoolId);
    
    // Administradores y dueños de escuela pueden gestionar todos los cursos
    return schoolRole === UserRole.SCHOOL_OWNER || schoolRole === UserRole.ADMIN;
  }

  /**
   * Verifica si un usuario está inscrito en un curso específico
   */
  async isEnrolledInCourse(userId: string, courseId: string): Promise<boolean> {
    if (!userId || !courseId) return false;
    
    const user = await this.userModel.findById(userId);
    if (!user) return false;
    
    // Verificar si el usuario ya está inscrito en el curso
    return user.enrolledCourses.some(id => id.toString() === courseId);
  }

  /**
   * Verifica si un usuario puede gestionar a otro usuario en una escuela
   */
  async canManageUserInSchool(
    managerId: string, 
    targetUserId: string, 
    schoolId: string
  ): Promise<boolean> {
    if (!managerId || !targetUserId || !schoolId) return false;
    
    // No se puede gestionar a uno mismo
    if (managerId === targetUserId) return false;
    
    const manager = await this.userModel.findById(managerId);
    if (!manager) return false;
    
    this.logger.log(`Checking if user ${managerId} (role: ${manager.role}) can manage user ${targetUserId} in school ${schoolId}`);
    
    // Super admin puede gestionar a cualquier usuario en cualquier escuela
    if (String(manager.role).toLowerCase() === UserRole.SUPER_ADMIN.toLowerCase()) {
      this.logger.log(`User is super_admin, allowing management`);
      return true;
    }
    
    const targetUser = await this.userModel.findById(targetUserId);
    if (!targetUser) return false;
    
    // Obtener roles contextuales
    const managerRole = await this.getUserRoleInSchool(managerId, schoolId);
    
    this.logger.log(`Manager role in school: ${managerRole}`);
    
    // Si el manager no tiene rol en esta escuela
    if (!managerRole) return false;
    
    // El target user puede no tener rol en esta escuela todavía, eso es válido
    const targetRole = await this.getUserRoleInSchool(targetUserId, schoolId);
    
    this.logger.log(`Target user role in school: ${targetRole}`);
    
    // Dueño de escuela puede gestionar a cualquiera excepto super admin
    if (String(managerRole).toLowerCase() === UserRole.SCHOOL_OWNER.toLowerCase()) {
      return String(targetUser.role).toLowerCase() !== UserRole.SUPER_ADMIN.toLowerCase();
    }
    
    // Admin puede gestionar profesores y estudiantes
    if (String(managerRole).toLowerCase() === UserRole.ADMIN.toLowerCase()) {
      // Si el target no tiene rol en esta escuela aún o es teacher/student
      if (!targetRole) return true;
      return String(targetRole).toLowerCase() === UserRole.TEACHER.toLowerCase() || 
             String(targetRole).toLowerCase() === UserRole.STUDENT.toLowerCase();
    }
    
    // Profesor solo puede gestionar estudiantes
    if (String(managerRole).toLowerCase() === UserRole.TEACHER.toLowerCase()) {
      // Si el target no tiene rol, o su rol es estudiante
      if (!targetRole) return true;
      if (String(targetRole).toLowerCase() === UserRole.STUDENT.toLowerCase()) {
      // Verificar si el estudiante está en alguno de los cursos del profesor
      const professorCourses = await this.courseModel.find({
        _id: { $in: manager.teachingCourses },
        school: schoolId
      });
      
      if (professorCourses.length === 0) return false;
      
      const professorCourseIds = professorCourses.map(c => c._id.toString());
      return targetUser.enrolledCourses.some(courseId => 
        professorCourseIds.includes(courseId.toString())
      );
      }
    }
    
    return false;
  }

  /**
   * Verifica si un usuario puede modificar un curso
   */
  async canModifyCourse(userId: string, courseId: string): Promise<boolean> {
    if (!userId || !courseId) return false;
    
    const user = await this.userModel.findById(userId);
    if (!user) return false;
    
    // Super admin puede modificar cualquier curso
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    // Verificar si es profesor del curso
    const isTeacher = user.teachingCourses.some(id => id.toString() === courseId);
    if (isTeacher) return true;
    
    // Verificar si es admin o dueño de la escuela
    const course = await this.courseModel.findById(courseId);
    if (!course) return false;
    
    const schoolId = course.school.toString();
    const schoolRole = await this.getUserRoleInSchool(userId, schoolId);
    
    return schoolRole === UserRole.SCHOOL_OWNER || schoolRole === UserRole.ADMIN;
  }

  /**
   * Verifica si un usuario puede eliminar una escuela
   */
  async canDeleteSchool(userId: string, schoolId: string): Promise<boolean> {
    if (!userId || !schoolId) return false;
    
    // Solo super admin y dueños de escuela pueden eliminar escuelas
    const schoolRole = await this.getUserRoleInSchool(userId, schoolId);
    return schoolRole === UserRole.SUPER_ADMIN || schoolRole === UserRole.SCHOOL_OWNER;
  }
  
  /**
   * Asigna un rol específico a un usuario en una escuela determinada
   * @param userId ID del usuario
   * @param schoolId ID de la escuela
   * @param role Rol a asignar
   * @returns true si se asignó correctamente, false si hubo algún error
   */
  async assignRoleInSchool(userId: string, schoolId: string, role: string): Promise<boolean> {
    try {
      // Normalize role value to lowercase for consistent comparison
      const normalizedRole = role.toLowerCase();
      
      this.logger.log(`Asignando rol ${normalizedRole} al usuario ${userId} en la escuela ${schoolId}`);
      
      // Validar que role no esté vacío
      if (!normalizedRole) {
        this.logger.error('El rol no puede estar vacío');
        return false;
      }
      
      // Verificar que el userId y schoolId son ObjectIds válidos
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(schoolId)) {
        this.logger.error(`ID inválido - userId: ${userId}, schoolId: ${schoolId}`);
        return false;
      }
      
      // Verificar que el usuario existe
    const user = await this.userModel.findById(userId);
      if (!user) {
        this.logger.error(`Usuario ${userId} no encontrado`);
        return false;
      }
    
      // Verificar que la escuela existe
    const school = await this.schoolModel.findById(schoolId);
      if (!school) {
        this.logger.error(`Escuela ${schoolId} no encontrada`);
        return false;
      }
      
      // Inicializar schoolRoles si no existe
      if (!user.schoolRoles) {
        user.schoolRoles = [];
      }
      
      // Convertir explícitamente a ObjectId
      const schoolIdObj = new mongoose.Types.ObjectId(schoolId);
      
      // Verificar si el usuario ya tiene un rol en esta escuela
      const existingRoleIndex = user.schoolRoles.findIndex(
        sr => sr.schoolId && sr.schoolId.toString() === schoolId
    );
    
      this.logger.log(`Estado actual de schoolRoles: ${JSON.stringify(user.schoolRoles)}`);
      
      if (existingRoleIndex >= 0) {
        // Si ya tiene un rol, actualizarlo
        this.logger.log(`Actualizando rol existente en índice ${existingRoleIndex}`);
        user.schoolRoles[existingRoleIndex].role = normalizedRole;
      } else {
        // Si no tiene un rol, añadir uno nuevo
        this.logger.log(`Añadiendo nuevo rol`);
    user.schoolRoles.push({
          schoolId: schoolIdObj,
          role: normalizedRole
    });
      }
    
      // Asegurar que el usuario esté asociado a la escuela
      if (!user.schools) {
        user.schools = [];
      }
      
      // Verificar si la escuela ya está asociada
      const hasSchool = user.schools.some(id => id.toString() === schoolId);
      
      // Solo añadir la escuela si no está ya incluida
      if (!hasSchool) {
        user.schools.push(schoolIdObj);
      }
      
      // Guardar los cambios
      this.logger.log(`Guardando usuario con schoolRoles actualizados: ${JSON.stringify(user.schoolRoles)}`);
      await user.save();
    
      // Actualizar listas correspondientes en la escuela según el rol asignado
      // Si es un rol especial (admin, school_owner, super_admin), establecer relaciones adicionales
      if (normalizedRole === 'school_owner') {
        // Añadir la escuela a ownedSchools del usuario si no está ya
        if (!user.ownedSchools.some(id => id.toString() === schoolId)) {
          user.ownedSchools.push(schoolIdObj);
          await user.save();
        }
        
        // Actualizar el admin de la escuela
        await this.schoolModel.updateOne(
          { _id: schoolId },
          { admin: userId }
        );
    }
      else if (normalizedRole === 'admin') {
        // Añadir la escuela a administratedSchools del usuario si no está ya
        if (!user.administratedSchools.some(id => id.toString() === schoolId)) {
          user.administratedSchools.push(schoolIdObj);
    await user.save();
        }
      }
      // Actualizar las colecciones regulares
      else if (normalizedRole === 'teacher') {
        const hasTeacher = school.teachers.some(id => id.toString() === userId);
        if (!hasTeacher) {
          await this.schoolModel.updateOne(
            { _id: schoolId },
            { $addToSet: { teachers: userId } }
          );
        }
      } else if (normalizedRole === 'student') {
        const hasStudent = school.students.some(id => id.toString() === userId);
        if (!hasStudent) {
          await this.schoolModel.updateOne(
            { _id: schoolId },
            { $addToSet: { students: userId } }
          );
        }
      } else if (normalizedRole === 'administrative') {
        if (!school.administratives) {
          school.administratives = [];
          await this.schoolModel.updateOne(
            { _id: schoolId },
            { $set: { administratives: [] } }
          );
        }
        
        const hasAdministrative = school.administratives.some(id => id.toString() === userId);
        if (!hasAdministrative) {
          await this.schoolModel.updateOne(
            { _id: schoolId },
            { $addToSet: { administratives: userId } }
          );
        }
      }
      
    return true;
    } catch (error) {
      this.logger.error(`Error al asignar rol: ${error.message}`);
      this.logger.error(error.stack);
      return false;
    }
  }
} 