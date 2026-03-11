import {
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
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
import { Subscription } from '../plans/schemas/subscription.schema';
import { Plan } from '../plans/schemas/plan.schema';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_OWNER,
  UserRole.ADMIN,
  UserRole.ADMINISTRATIVE,
)
export class AdminStatsController {
  private readonly logger = new Logger(AdminStatsController.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Class.name) private classModel: Model<Class>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
  ) {}

  @Get()
  async getStats(@Query('schoolId') schoolId: string, @Request() req) {
    try {
      // Asegurarnos de obtener el ID de usuario correctamente
      const user = req.user;
      // Normalizar user._id para asegurarse de que es un string
      const userId = user.sub || (user._id ? user._id.toString() : null);
      if (!userId) {
        throw new UnauthorizedException('ID de usuario no disponible');
      }

      const stats: any = {};

      // Si schoolId es provided y no es 'all', verificar acceso
      if (schoolId && schoolId !== 'all') {
        const hasAccess = await this.checkSchoolAccess(user, schoolId);
        if (!hasAccess) {
          throw new ForbiddenException('Acceso denegado a la escuela');
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
          const ownedSchools = await this.schoolModel.find({ admin: userId });
          const schoolIds = ownedSchools.map((school) => school._id);

          stats.users = await this.getUserCountForSchools(schoolIds);
          stats.schools = schoolIds.length;
          stats.courses = await this.getCourseCountForSchools(schoolIds);
          stats.classes = await this.getClassCountForSchools(schoolIds);
        } else if (user.role === UserRole.ADMIN) {
          // Admin sees stats for administered schools
          const adminSchools = await this.schoolModel.find({
            teachers: userId,
          });
          const schoolIds = adminSchools.map((school) => school._id);

          stats.users = await this.getUserCountForSchools(schoolIds);
          stats.schools = schoolIds.length;
          stats.courses = await this.getCourseCountForSchools(schoolIds);
          stats.classes = await this.getClassCountForSchools(schoolIds);
        } else if (user.role === UserRole.ADMINISTRATIVE) {
          // Para 'administrative', buscar en ambos enfoques: school.administratives y user.administratedSchools
          const userDoc = await this.userModel.findById(userId);
          const userAdministratedSchools = userDoc?.administratedSchools || [];

          const administrativeSchools = await this.schoolModel.find({
            $or: [
              { administratives: userId },
              { teachers: userId },
              { _id: { $in: userAdministratedSchools } },
            ],
          });
          const schoolIds = administrativeSchools.map((school) => school._id);
          stats.users = await this.getUserCountForSchools(schoolIds);
          stats.schools = schoolIds.length;
          stats.courses = await this.getCourseCountForSchools(schoolIds);
          stats.classes = await this.getClassCountForSchools(schoolIds);
        }
      }

      return stats;
    } catch (error) {
      this.logger.error(`Error getting stats: ${error.message}`, error.stack);
      if (error?.getStatus) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener estadísticas');
    }
  }

  @Get('subscriptions')
  @Roles(UserRole.SUPER_ADMIN)
  async getSubscriptionsStats() {
    try {
      const totalSubscriptions = await this.subscriptionModel.countDocuments();
      const activePlans = await this.planModel.countDocuments({
        isActive: true,
      });

      // Get count by plan type
      const subscriptionsByPlan = await this.subscriptionModel.aggregate([
        {
          $lookup: {
            from: 'plans',
            localField: 'plan',
            foreignField: '_id',
            as: 'planInfo',
          },
        },
        { $unwind: '$planInfo' },
        {
          $group: {
            _id: '$planInfo.type',
            count: { $sum: 1 },
            avgStorageUsed: { $avg: '$currentStorageGb' },
            avgStreamingMinutes: { $avg: '$currentStreamingMinutes' },
          },
        },
      ]);

      // Get count by status
      const subscriptionsByStatus = await this.subscriptionModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

      // Top schools by resource usage
      const topSchoolsByStorage = await this.schoolModel
        .find({ activeSubscription: { $exists: true } })
        .sort({ storageUsedGb: -1 })
        .limit(5)
        .select('name storageUsedGb');

      return {
        totalSubscriptions,
        activePlans,
        subscriptionsByPlan,
        subscriptionsByStatus,
        topSchoolsByStorage,
      };
    } catch (error) {
      this.logger.error(
        `Error getting subscription stats: ${error.message}`,
        error.stack,
      );
      if (error?.getStatus) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al obtener estadísticas de suscripciones',
      );
    }
  }

  @Get('subscriptions/:schoolId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER)
  async getSchoolSubscriptionDetails(
    @Param('schoolId') schoolId: string,
    @Request() req,
  ) {
    try {
      const user = req.user;

      // Verify access for non-super-admin users
      if (user.role !== UserRole.SUPER_ADMIN) {
        const hasAccess = await this.checkSchoolAccess(user, schoolId);
        if (!hasAccess) {
          throw new ForbiddenException('No tienes acceso a esta escuela');
        }
      }

      const school = await this.schoolModel.findById(schoolId);
      if (!school) {
        throw new NotFoundException('Escuela no encontrada');
      }

      if (!school.activeSubscription) {
        throw new NotFoundException(
          'Esta escuela no tiene una suscripción activa',
        );
      }

      // Get subscription details with plan info
      const subscription = await this.subscriptionModel
        .findById(school.activeSubscription)
        .populate('plan');

      if (!subscription) {
        throw new NotFoundException('Suscripción no encontrada');
      }

      // Calculate usage percentages
      const plan = subscription.plan as any;
      const storageLimit =
        plan.maxStorageGb +
        (subscription.approvedExtraResources?.extraStorageGb || 0);
      const storagePercentage = Math.min(
        100,
        (school.storageUsedGb / storageLimit) * 100,
      );

      const streamingLimit =
        plan.maxStreamingMinutesPerMonth +
        (subscription.approvedExtraResources?.extraStreamingMinutes || 0);
      const streamingPercentage = Math.min(
        100,
        (subscription.currentStreamingMinutes / streamingLimit) * 100,
      );

      // Get user count
      const userCount = await this.getUserCountForSchool(schoolId);
      const userLimit =
        plan.maxUsers + (subscription.approvedExtraResources?.extraUsers || 0);
      const userPercentage = Math.min(100, (userCount / userLimit) * 100);

      // Get courses per user (average)
      const courses = await this.courseModel.find({ school: schoolId });
      const coursePerUserLimit =
        plan.maxCoursesPerUser +
        (subscription.approvedExtraResources?.extraCoursesPerUser || 0);

      // Monthly usage history
      const monthlyUsage = subscription.usageHistory || [];

      return {
        schoolId,
        schoolName: school.name,
        planName: plan.name,
        planType: plan.type,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,

        storage: {
          used: school.storageUsedGb,
          limit: storageLimit,
          percentage: storagePercentage,
        },

        streaming: {
          used: subscription.currentStreamingMinutes,
          limit: streamingLimit,
          percentage: streamingPercentage,
        },

        users: {
          count: userCount,
          limit: userLimit,
          percentage: userPercentage,
        },

        coursesPerUser: {
          limit: coursePerUserLimit,
        },

        extraResourcesApproved: subscription.approvedExtraResources,
        monthlyUsage,
      };
    } catch (error) {
      this.logger.error(
        `Error getting school subscription details: ${error.message}`,
        error.stack,
      );
      if (error?.getStatus) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Error al obtener detalles de suscripción de la escuela',
      );
    }
  }

  @Get('test')
  testEndpoint() {
    return {
      message: 'Admin stats test endpoint is working!',
      path: '/admin/stats/test',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('overview')
  async getOverviewStats(@Request() req) {
    return await this.getStats(null, req);
  }

  private async checkSchoolAccess(
    user: any,
    schoolId: string,
  ): Promise<boolean> {
    const userId = user.sub || (user._id ? user._id.toString() : null);
    if (!userId) {
      return false;
    }
    if (user.role === UserRole.SUPER_ADMIN) {
      return true; // Super admin has access to all schools
    }
    const school = await this.schoolModel.findById(schoolId);
    if (!school) {
      return false;
    }
    // Check if user is admin or teacher
    const isAdmin = school.admin && school.admin.toString() === userId;
    const isTeacher =
      school.teachers &&
      school.teachers.some((teacherId) => teacherId.toString() === userId);
    // Permitir administrativos si están en school.administratives
    const isAdministrative =
      school.administratives &&
      school.administratives.some((adminId) => adminId.toString() === userId);
    if (user.role === UserRole.SCHOOL_OWNER) return isAdmin;
    if (user.role === UserRole.ADMIN) return isAdmin || isTeacher;
    if (user.role === UserRole.ADMINISTRATIVE) return isAdministrative;
    return isAdmin || isTeacher || isAdministrative;
  }

  private async getUserCountForSchool(schoolId: string): Promise<number> {
    return this.userModel.countDocuments({
      schools: schoolId,
    });
  }

  private async getUserCountForSchools(schoolIds: any[]): Promise<number> {
    return this.userModel.countDocuments({
      schools: { $in: schoolIds },
    });
  }

  private async getCourseCountForSchool(schoolId: string): Promise<number> {
    return this.courseModel.countDocuments({
      school: schoolId,
    });
  }

  private async getCourseCountForSchools(schoolIds: any[]): Promise<number> {
    return this.courseModel.countDocuments({
      school: { $in: schoolIds },
    });
  }

  private async getClassCountForSchool(schoolId: string): Promise<number> {
    const courses = await this.courseModel.find({ school: schoolId });
    const courseIds = courses.map((course) => course._id);
    return this.classModel.countDocuments({
      course: { $in: courseIds },
    });
  }

  private async getClassCountForSchools(schoolIds: any[]): Promise<number> {
    const courses = await this.courseModel.find({ school: { $in: schoolIds } });
    const courseIds = courses.map((course) => course._id);
    return this.classModel.countDocuments({
      course: { $in: courseIds },
    });
  }
}
