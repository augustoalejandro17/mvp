import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserRole } from '../schemas/user.schema';
import { School } from '../../schools/schemas/school.schema';
import { Course } from '../../courses/schemas/course.schema';

@Injectable()
export class AuthorizationService {
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
   * @returns El rol del usuario en la escuela o null si no tiene un rol asignado
   */
  async getUserRoleInSchool(userId: string, schoolId: string): Promise<UserRole | null> {
    if (!userId || !schoolId) return null;
    
    const user = await this.userModel.findById(userId);
    if (!user) return null;
    
    // El super admin tiene rol super admin en todas partes
    if (user.role === UserRole.SUPER_ADMIN) {
      return UserRole.SUPER_ADMIN;
    }
    
    // Buscar un rol específico para esta escuela
    const schoolRole = user.schoolRoles.find(
      sr => sr.schoolId.toString() === schoolId
    );
    
    if (schoolRole) {
      // Si tiene un rol específico para esta escuela, devolver ese rol
      return schoolRole.role;
    }
    
    // Si es dueño de la escuela, su rol es SCHOOL_OWNER
    if (user.ownedSchools.some(id => id.toString() === schoolId)) {
      return UserRole.SCHOOL_OWNER;
    }
    
    // Si es administrador de la escuela, su rol es ADMIN
    if (user.administratedSchools.some(id => id.toString() === schoolId)) {
      return UserRole.ADMIN;
    }
    
    // Si es profesor en algún curso de la escuela, su rol es TEACHER
    if (user.role === UserRole.TEACHER) {
      // Verificar si tiene cursos en esta escuela
      const teachingCoursesInSchool = await this.courseModel.countDocuments({
        _id: { $in: user.teachingCourses },
        school: schoolId
      });
      
      if (teachingCoursesInSchool > 0) {
        return UserRole.TEACHER;
      }
    }
    
    // Si está inscrito en algún curso de la escuela, su rol es STUDENT
    const enrolledCoursesInSchool = await this.courseModel.countDocuments({
      _id: { $in: user.enrolledCourses },
      school: schoolId
    });
    
    if (enrolledCoursesInSchool > 0) {
      return UserRole.STUDENT;
    }
    
    // Si está en las escuelas pero no tiene un rol específico, usar su rol global
    if (user.schools.some(id => id.toString() === schoolId)) {
      return user.role;
    }
    
    // No tiene relación con esta escuela
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
    
    const targetUser = await this.userModel.findById(targetUserId);
    if (!targetUser) return false;
    
    // Obtener roles contextuales
    const managerRole = await this.getUserRoleInSchool(managerId, schoolId);
    const targetRole = await this.getUserRoleInSchool(targetUserId, schoolId);
    
    // Si alguno no tiene rol en esta escuela
    if (!managerRole || !targetRole) return false;
    
    // Super admin puede gestionar a cualquiera
    if (managerRole === UserRole.SUPER_ADMIN) return true;
    
    // Dueño de escuela puede gestionar a cualquiera excepto super admin
    if (managerRole === UserRole.SCHOOL_OWNER) {
      return targetRole !== UserRole.SUPER_ADMIN;
    }
    
    // Admin puede gestionar profesores y estudiantes
    if (managerRole === UserRole.ADMIN) {
      return targetRole === UserRole.TEACHER || targetRole === UserRole.STUDENT;
    }
    
    // Profesor solo puede gestionar estudiantes
    if (managerRole === UserRole.TEACHER && targetRole === UserRole.STUDENT) {
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
   * Asigna un rol específico a un usuario en una escuela
   */
  async assignRoleInSchool(userId: string, schoolId: string, role: UserRole): Promise<boolean> {
    if (!userId || !schoolId) return false;
    
    const user = await this.userModel.findById(userId);
    if (!user) return false;
    
    // Verificar si la escuela existe
    const school = await this.schoolModel.findById(schoolId);
    if (!school) return false;
    
    // Primero eliminar cualquier rol existente en esta escuela
    user.schoolRoles = user.schoolRoles.filter(
      sr => sr.schoolId.toString() !== schoolId
    );
    
    // Agregar el nuevo rol
    user.schoolRoles.push({
      schoolId: school._id as any,
      role
    });
    
    // Asegurar que el usuario esté asociado con la escuela
    if (!user.schools.some(id => id.toString() === schoolId)) {
      user.schools.push(school._id as any);
    }
    
    // Actualizar listas específicas según el rol
    if (role === UserRole.SCHOOL_OWNER && !user.ownedSchools.some(id => id.toString() === schoolId)) {
      user.ownedSchools.push(school._id as any);
    }
    
    if (role === UserRole.ADMIN && !user.administratedSchools.some(id => id.toString() === schoolId)) {
      user.administratedSchools.push(school._id as any);
    }
    
    await user.save();
    return true;
  }
} 