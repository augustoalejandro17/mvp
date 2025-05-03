import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { School } from '../schools/schemas/school.schema';
import { Course } from '../courses/schemas/course.schema';
import { Class } from '../classes/schemas/class.schema';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER, UserRole.ADMIN)
export class AdminStatsController {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Class.name) private classModel: Model<Class>,
  ) {}

  @Get()
  async getStats(@Query('schoolId') schoolId: string, @Request() req) {
    try {
      const user = req.user;
      const stats: any = {};
      
      console.log(`[AdminStatsController] Getting stats for user ${user.email}, ID: ${user._id}, role: ${user.role}. School filter: ${schoolId || 'all'}`);
      
      // If schoolId is provided and not 'all', check access rights
      if (schoolId && schoolId !== 'all') {
        console.log(`[AdminStatsController] Checking access for school ID: ${schoolId}`);
        const hasAccess = await this.checkSchoolAccess(user, schoolId);
        console.log(`[AdminStatsController] User has access to school ${schoolId}: ${hasAccess}`);
        if (!hasAccess) {
          console.log(`[AdminStatsController] Access denied to school ${schoolId}`);
          return {
            users: 0,
            schools: 0,
            courses: 0,
            classes: 0,
            message: 'No tienes acceso a esta escuela'
          };
        }
        
        // Get stats for specific school
        stats.users = await this.getUserCountForSchool(schoolId);
        stats.schools = 1; // Just the requested school
        stats.courses = await this.getCourseCountForSchool(schoolId);
        stats.classes = await this.getClassCountForSchool(schoolId);
      } else {
        // Get global stats or filtered by user's role
        if (user.role === UserRole.SUPER_ADMIN) {
          // Super admin can see all stats
          stats.users = await this.userModel.countDocuments();
          stats.schools = await this.schoolModel.countDocuments();
          stats.courses = await this.courseModel.countDocuments();
          stats.classes = await this.classModel.countDocuments();
        } else if (user.role === UserRole.SCHOOL_OWNER) {
          // School owner sees stats for their schools
          const ownedSchools = await this.schoolModel.find({ admin: user._id });
          const schoolIds = ownedSchools.map(school => school._id);
          
          stats.users = await this.getUserCountForSchools(schoolIds);
          stats.schools = schoolIds.length;
          stats.courses = await this.getCourseCountForSchools(schoolIds);
          stats.classes = await this.getClassCountForSchools(schoolIds);
        } else if (user.role === UserRole.ADMIN) {
          // Admin sees stats for administered schools
          const adminSchools = await this.schoolModel.find({ teachers: user._id });
          const schoolIds = adminSchools.map(school => school._id);
          
          stats.users = await this.getUserCountForSchools(schoolIds);
          stats.schools = schoolIds.length;
          stats.courses = await this.getCourseCountForSchools(schoolIds);
          stats.classes = await this.getClassCountForSchools(schoolIds);
        }
      }
      
      return stats;
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        users: 0,
        schools: 0,
        courses: 0,
        classes: 0,
        error: 'Error al obtener estadísticas'
      };
    }
  }

  @Get('test')
  testEndpoint() {
    console.log("[AdminStatsController] Test endpoint called at /api/admin/stats/test");
    return { 
      message: 'Admin stats test endpoint is working!',
      path: '/admin/stats/test',
      timestamp: new Date().toISOString()
    };
  }

  @Get('public-test')
  @UseGuards()
  publicTestEndpoint() {
    console.log("[AdminStatsController] Public test endpoint called at /api/admin/stats/public-test");
    return { 
      message: 'Public admin stats test endpoint is working without auth!',
      path: '/admin/stats/public-test',
      timestamp: new Date().toISOString()
    };
  }

  // Helper methods
  private async checkSchoolAccess(user: any, schoolId: string): Promise<boolean> {
    if (user.role === UserRole.SUPER_ADMIN) {
      return true; // Super admin has access to all schools
    }
    
    const school = await this.schoolModel.findById(schoolId);
    if (!school) {
      return false;
    }
    
    // Check if user is admin or teacher
    const isAdmin = school.admin && school.admin.toString() === user._id.toString();
    const isTeacher = school.teachers && 
      school.teachers.some(teacherId => teacherId.toString() === user._id.toString());
    
    return isAdmin || isTeacher;
  }
  
  private async getUserCountForSchool(schoolId: string): Promise<number> {
    return this.userModel.countDocuments({
      schools: schoolId
    });
  }
  
  private async getUserCountForSchools(schoolIds: any[]): Promise<number> {
    return this.userModel.countDocuments({
      schools: { $in: schoolIds }
    });
  }
  
  private async getCourseCountForSchool(schoolId: string): Promise<number> {
    return this.courseModel.countDocuments({
      school: schoolId
    });
  }
  
  private async getCourseCountForSchools(schoolIds: any[]): Promise<number> {
    return this.courseModel.countDocuments({
      school: { $in: schoolIds }
    });
  }
  
  private async getClassCountForSchool(schoolId: string): Promise<number> {
    const courses = await this.courseModel.find({ school: schoolId });
    const courseIds = courses.map(course => course._id);
    return this.classModel.countDocuments({
      course: { $in: courseIds }
    });
  }
  
  private async getClassCountForSchools(schoolIds: any[]): Promise<number> {
    const courses = await this.courseModel.find({ school: { $in: schoolIds } });
    const courseIds = courses.map(course => course._id);
    return this.classModel.countDocuments({
      course: { $in: courseIds }
    });
  }
} 