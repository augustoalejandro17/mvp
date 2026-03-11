import {
  ForbiddenException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { UserRole } from '../../auth/schemas/user.schema';
import { RetentionService } from '../services/retention.service';
import { PerformanceService } from '../services/performance.service';
import { RevenueService } from '../services/revenue.service';
import { DropoutService } from '../services/dropout.service';
import { DemographicsService } from '../services/demographics.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';
import { Course } from '../../courses/schemas/course.schema';
import { Class } from '../../classes/schemas/class.schema';
import { School } from '../../schools/schemas/school.schema';
import { Subscription } from '../../plans/schemas/subscription.schema';
import { Plan } from '../../plans/schemas/plan.schema';
import {
  DateRangeDto,
  RetentionRateDto,
  TeacherPerformanceDto,
  RevenueDto,
  DropoutRateDto,
  AgeDistributionDto,
  StatisticsResponseDto,
} from '../dto/statistics.dto';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_OWNER,
  UserRole.ADMIN,
  UserRole.ADMINISTRATIVE,
)
export class StatisticsController {
  private readonly logger = new Logger(StatisticsController.name);

  constructor(
    private retentionService: RetentionService,
    private performanceService: PerformanceService,
    private revenueService: RevenueService,
    private dropoutService: DropoutService,
    private demographicsService: DemographicsService,
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Class.name) private classModel: Model<Class>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMIN,
    UserRole.ADMINISTRATIVE,
  )
  async getStats(@Query('schoolId') schoolId: string, @Request() req) {
    try {
      const user = req.user;
      const userId = user.sub || (user._id ? user._id.toString() : null);
      if (!userId) {
        throw new UnauthorizedException('ID de usuario no disponible');
      }

      const stats: any = {};

      if (schoolId && schoolId !== 'all') {
        // Asegurarse de que checkSchoolAccess existe o moverlo aquí
        const hasAccess = await this.checkSchoolAccess(user, schoolId);
        if (!hasAccess) {
          throw new ForbiddenException('Acceso denegado a la escuela');
        }
        stats.users = await this.getUserCountForSchool(schoolId);
        stats.schools = 1;
        stats.courses = await this.getCourseCountForSchool(schoolId);
        stats.classes = await this.getClassCountForSchool(schoolId);
      } else {
        if (user.role === UserRole.SUPER_ADMIN) {
          stats.users = await this.userModel.countDocuments();
          stats.schools = await this.schoolModel.countDocuments();
          stats.courses = await this.courseModel.countDocuments();
          stats.classes = await this.classModel.countDocuments();
        } else if (user.role === UserRole.SCHOOL_OWNER) {
          const ownedSchools = await this.schoolModel.find({ admin: userId });
          const schoolIds = ownedSchools.map((school) => school._id);
          stats.users = await this.getUserCountForSchools(schoolIds);
          stats.schools = schoolIds.length;
          stats.courses = await this.getCourseCountForSchools(schoolIds);
          stats.classes = await this.getClassCountForSchools(schoolIds);
        } else if (user.role === UserRole.ADMIN) {
          // Para 'admin', asumimos que son administradores de escuelas específicas (ej. teachers con rol admin)
          // Esta lógica puede necesitar ajustarse según tu definición exacta de 'ADMIN'
          const adminSchools = await this.schoolModel.find({
            $or: [{ admin: userId }, { teachers: userId }],
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
      throw new InternalServerErrorException(
        'Error al obtener estadísticas generales',
      );
    }
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
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
      const userCount = await this.userModel.countDocuments({
        schools: schoolId,
      });
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

  @Get('overview')
  async getOverviewStats(@Request() req) {
    // Obtener información básica para el dashboard
    const dateRange = {
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: new Date(),
    };

    // Obtener todas las métricas básicas en paralelo
    const [retentionRates, teacherPerformance, revenue] = await Promise.all([
      this.retentionService.getRetentionRatesByCourse(),
      this.performanceService.getTeachersPerformance(),
      this.revenueService.getRevenueMetrics(dateRange),
    ]);

    // Calcular resumen de estadísticas generales
    const totalStudents = retentionRates.reduce(
      (sum, course) => sum + course.initialEnrollment,
      0,
    );
    const activeStudents = retentionRates.reduce(
      (sum, course) => sum + course.currentEnrollment,
      0,
    );
    const totalCourses = retentionRates.length;
    const totalTeachers = teacherPerformance.length;

    return {
      usersCount: activeStudents,
      coursesCount: totalCourses,
      teachersCount: totalTeachers,
      totalRevenue: revenue.totalRevenue,
      retentionRate:
        activeStudents > 0
          ? Math.round((activeStudents / totalStudents) * 100)
          : 0,
      timestamp: new Date().toISOString(),
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  @Get('all')
  async getAllStatistics(
    @Query() dateRange: DateRangeDto,
  ): Promise<StatisticsResponseDto> {
    // Establecer fechas por defecto si no se proporcionan
    if (!dateRange.startDate || !dateRange.endDate) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - 1); // Último mes por defecto

      dateRange = {
        startDate,
        endDate,
      };
    }

    // Obtener todas las métricas en paralelo
    const [
      retentionRates,
      teacherPerformance,
      revenue,
      dropoutRates,
      overallDropoutRate,
      ageDistribution,
    ] = await Promise.all([
      this.retentionService.getRetentionRatesByCourse(),
      this.performanceService.getTeachersPerformance(),
      this.revenueService.getRevenueMetrics(dateRange),
      this.dropoutService.getDropoutRatesByCourse(),
      this.dropoutService.getOverallDropoutRate(),
      this.demographicsService.getAgeDistribution(),
    ]);

    return {
      retentionRates,
      teacherPerformance,
      revenue,
      dropoutRates,
      overallDropoutRate,
      ageDistribution,
    };
  }

  @Get('retention')
  async getRetentionRates(): Promise<RetentionRateDto[]> {
    return this.retentionService.getRetentionRatesByCourse();
  }

  @Get('retention/:courseId')
  async getRetentionRateForCourse(
    @Param('courseId') courseId: string,
  ): Promise<RetentionRateDto> {
    return this.retentionService.getRetentionRateForCourse(courseId);
  }

  @Get('performance')
  async getTeachersPerformance(): Promise<TeacherPerformanceDto[]> {
    return this.performanceService.getTeachersPerformance();
  }

  @Get('performance/:teacherId')
  async getTeacherPerformance(
    @Param('teacherId') teacherId: string,
  ): Promise<TeacherPerformanceDto> {
    return this.performanceService.getTeacherPerformance(teacherId);
  }

  @Post('revenue')
  async getRevenueMetrics(
    @Body() dateRange: DateRangeDto,
  ): Promise<RevenueDto> {
    return this.revenueService.getRevenueMetrics(dateRange);
  }

  @Get('revenue/monthly')
  async getMonthlyRevenue(): Promise<any> {
    return this.revenueService.getMonthlyRevenue();
  }

  @Get('revenue/courses')
  async getRevenueByCourse(): Promise<any> {
    return this.revenueService.getRevenueByCourse();
  }

  @Get('dropout')
  async getDropoutRates(): Promise<DropoutRateDto[]> {
    return this.dropoutService.getDropoutRatesByCourse();
  }

  @Get('dropout/overall')
  async getOverallDropoutRate(): Promise<number> {
    return this.dropoutService.getOverallDropoutRate();
  }

  @Get('dropout/:courseId')
  async getCourseDropoutDetails(
    @Param('courseId') courseId: string,
  ): Promise<DropoutRateDto> {
    return this.dropoutService.getCourseDropoutDetails(courseId);
  }

  @Get('demographics/age')
  async getAgeDistribution(): Promise<AgeDistributionDto> {
    return this.demographicsService.getAgeDistribution();
  }

  @Get('demographics/age/courses')
  async getAgeDistributionByCourse(): Promise<any> {
    return this.demographicsService.getAgeDistributionByCourse();
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
      return true;
    }
    const school = await this.schoolModel.findById(schoolId).lean();
    if (!school) {
      return false;
    }
    const isAdmin = school.admin && school.admin.toString() === userId;
    const isTeacher =
      Array.isArray(school.teachers) &&
      school.teachers.some(
        (teacherId) => teacherId && teacherId.toString() === userId,
      );
    // Permitir administrativos si están en school.administratives
    const isAdministrative =
      Array.isArray(school.administratives) &&
      school.administratives.some(
        (adminId) => adminId && adminId.toString() === userId,
      );
    if (user.role === UserRole.SCHOOL_OWNER) return isAdmin;
    if (user.role === UserRole.ADMIN) return isAdmin || isTeacher;
    if (user.role === UserRole.ADMINISTRATIVE) return isAdministrative;
    return isAdmin || isTeacher || isAdministrative;
  }

  private async getUserCountForSchool(schoolId: string): Promise<number> {
    return this.userModel.countDocuments({ schools: schoolId });
  }

  private async getUserCountForSchools(schoolIds: any[]): Promise<number> {
    if (!schoolIds || schoolIds.length === 0) return 0;
    return this.userModel.countDocuments({ schools: { $in: schoolIds } });
  }

  private async getCourseCountForSchool(schoolId: string): Promise<number> {
    return this.courseModel.countDocuments({ school: schoolId });
  }

  private async getCourseCountForSchools(schoolIds: any[]): Promise<number> {
    if (!schoolIds || schoolIds.length === 0) return 0;
    return this.courseModel.countDocuments({ school: { $in: schoolIds } });
  }

  private async getClassCountForSchool(schoolId: string): Promise<number> {
    // Suponiendo que las clases están vinculadas a cursos que pertenecen a una escuela
    const coursesInSchool = await this.courseModel
      .find({ school: schoolId })
      .select('_id')
      .lean();
    const courseIds = coursesInSchool.map((c) => c._id);
    if (courseIds.length === 0) return 0;
    return this.classModel.countDocuments({ course: { $in: courseIds } });
  }

  private async getClassCountForSchools(schoolIds: any[]): Promise<number> {
    if (!schoolIds || schoolIds.length === 0) return 0;
    const coursesInSchools = await this.courseModel
      .find({ school: { $in: schoolIds } })
      .select('_id')
      .lean();
    const courseIds = coursesInSchools.map((c) => c._id);
    if (courseIds.length === 0) return 0;
    return this.classModel.countDocuments({ course: { $in: courseIds } });
  }
}
