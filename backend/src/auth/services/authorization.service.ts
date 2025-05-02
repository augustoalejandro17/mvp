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
   * Verifica si un usuario es dueño de una escuela específica
   */
  async isSchoolOwner(userId: string, schoolId: string): Promise<boolean> {
    if (!userId || !schoolId) return false;
    
    const user = await this.userModel.findById(userId);
    if (!user) return false;
    
    // Super admin tiene acceso a todas las escuelas
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    // Verificar si el usuario es dueño de la escuela
    return user.role === UserRole.SCHOOL_OWNER && 
           user.ownedSchools.some(id => id.toString() === schoolId);
  }

  /**
   * Verifica si un usuario es administrador de una escuela específica
   */
  async isSchoolAdmin(userId: string, schoolId: string): Promise<boolean> {
    if (!userId || !schoolId) return false;
    
    const user = await this.userModel.findById(userId);
    if (!user) return false;
    
    // Super admin y dueños de escuela tienen poderes de administrador
    if (user.role === UserRole.SUPER_ADMIN) return true;
    if (user.role === UserRole.SCHOOL_OWNER && 
        user.ownedSchools.some(id => id.toString() === schoolId)) return true;
    
    // Verificar si el usuario es administrador de la escuela
    return user.role === UserRole.ADMIN && 
           user.administratedSchools.some(id => id.toString() === schoolId);
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
    if (user.role === UserRole.TEACHER) {
      return user.teachingCourses.some(id => id.toString() === courseId);
    }
    
    // Verificar si es admin o dueño de la escuela a la que pertenece el curso
    const course = await this.courseModel.findById(courseId);
    if (!course) return false;
    
    if (user.role === UserRole.SCHOOL_OWNER) {
      return user.ownedSchools.some(id => id.toString() === course.school.toString());
    }
    
    if (user.role === UserRole.ADMIN) {
      return user.administratedSchools.some(id => id.toString() === course.school.toString());
    }
    
    return false;
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
    
    // Super admin puede gestionar a cualquiera
    if (manager.role === UserRole.SUPER_ADMIN) return true;
    
    // Dueño de escuela puede gestionar a cualquiera en su escuela, excepto a otros dueños
    if (manager.role === UserRole.SCHOOL_OWNER && 
        manager.ownedSchools.some(id => id.toString() === schoolId)) {
      return targetUser.role !== UserRole.SUPER_ADMIN && 
             targetUser.role !== UserRole.SCHOOL_OWNER;
    }
    
    // Administrador puede gestionar a profesores y estudiantes en su escuela
    if (manager.role === UserRole.ADMIN && 
        manager.administratedSchools.some(id => id.toString() === schoolId)) {
      return targetUser.role !== UserRole.SUPER_ADMIN && 
             targetUser.role !== UserRole.SCHOOL_OWNER && 
             targetUser.role !== UserRole.ADMIN;
    }
    
    // Profesor solo puede gestionar estudiantes en sus cursos
    if (manager.role === UserRole.TEACHER) {
      // Verificar si el profesor tiene cursos en esta escuela
      const teacherCourses = await this.courseModel.find({
        _id: { $in: manager.teachingCourses },
        school: schoolId
      });
      
      if (teacherCourses.length === 0) return false;
      
      // Profesores solo pueden gestionar estudiantes
      if (targetUser.role !== UserRole.STUDENT) return false;
      
      // Verificar si el estudiante está inscrito en alguno de los cursos del profesor
      const courseIds = teacherCourses.map(course => course._id.toString());
      return targetUser.enrolledCourses.some(courseId => 
        courseIds.includes(courseId.toString())
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
    
    const course = await this.courseModel.findById(courseId);
    if (!course) return false;
    
    // Verificar si es dueño de la escuela
    if (user.role === UserRole.SCHOOL_OWNER) {
      return user.ownedSchools.some(id => id.toString() === course.school.toString());
    }
    
    // Verificar si es administrador de la escuela
    if (user.role === UserRole.ADMIN) {
      return user.administratedSchools.some(id => id.toString() === course.school.toString());
    }
    
    // Los profesores solo pueden modificar sus propios cursos
    if (user.role === UserRole.TEACHER) {
      return user.teachingCourses.some(id => id.toString() === courseId);
    }
    
    return false;
  }

  /**
   * Verifica si un usuario puede eliminar una escuela
   */
  async canDeleteSchool(userId: string, schoolId: string): Promise<boolean> {
    if (!userId || !schoolId) return false;
    
    const user = await this.userModel.findById(userId);
    if (!user) return false;
    
    // Solo super admin y dueños de escuela pueden eliminar escuelas
    if (user.role === UserRole.SUPER_ADMIN) return true;
    
    if (user.role === UserRole.SCHOOL_OWNER) {
      return user.ownedSchools.some(id => id.toString() === schoolId);
    }
    
    return false;
  }
} 