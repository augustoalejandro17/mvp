import { Controller, Get, Post, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
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
  StatisticsResponseDto 
} from '../dto/statistics.dto';

@ApiTags('statistics')
@Controller('admin/stats')
export class StatisticsController {
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
    @InjectModel(Subscription.name) private subscriptionModel: Model<Subscription>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
  ) {}

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Obtener estadísticas de suscripciones' })
  async getSubscriptionsStats() {
    try {
      const totalSubscriptions = await this.subscriptionModel.countDocuments();
      const activePlans = await this.planModel.countDocuments({ isActive: true });
      
      // Get count by plan type
      const subscriptionsByPlan = await this.subscriptionModel.aggregate([
        {
          $lookup: {
            from: 'plans',
            localField: 'plan',
            foreignField: '_id',
            as: 'planInfo'
          }
        },
        { $unwind: '$planInfo' },
        {
          $group: {
            _id: '$planInfo.type',
            count: { $sum: 1 },
            avgStorageUsed: { $avg: '$currentStorageGb' },
            avgStreamingMinutes: { $avg: '$currentStreamingMinutes' }
          }
        }
      ]);
      
      // Get count by status
      const subscriptionsByStatus = await this.subscriptionModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
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
        topSchoolsByStorage
      };
    } catch (error) {
      console.error('Error getting subscription stats:', error);
      return {
        error: 'Error al obtener estadísticas de suscripciones'
      };
    }
  }

  @Get('subscriptions/:schoolId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.SCHOOL_OWNER)
  @ApiOperation({ summary: 'Obtener detalles de suscripción de una escuela' })
  async getSchoolSubscriptionDetails(@Param('schoolId') schoolId: string, @Request() req) {
    try {
      const user = req.user;
      
      // Verify access for non-super-admin users
      if (user.role !== UserRole.SUPER_ADMIN) {
        const hasAccess = await this.checkSchoolAccess(user, schoolId);
        if (!hasAccess) {
          return { error: 'No tienes acceso a esta escuela' };
        }
      }
      
      const school = await this.schoolModel.findById(schoolId);
      if (!school) {
        return { error: 'Escuela no encontrada' };
      }
      
      if (!school.activeSubscription) {
        return { error: 'Esta escuela no tiene una suscripción activa' };
      }
      
      // Get subscription details with plan info
      const subscription = await this.subscriptionModel
        .findById(school.activeSubscription)
        .populate('plan');
      
      if (!subscription) {
        return { error: 'Suscripción no encontrada' };
      }
      
      // Calculate usage percentages
      const plan = subscription.plan as any;
      const storageLimit = plan.maxStorageGb + (subscription.approvedExtraResources?.extraStorageGb || 0);
      const storagePercentage = Math.min(100, (school.storageUsedGb / storageLimit) * 100);
      
      const streamingLimit = plan.maxStreamingMinutesPerMonth + 
        (subscription.approvedExtraResources?.extraStreamingMinutes || 0);
      const streamingPercentage = Math.min(100, 
        (subscription.currentStreamingMinutes / streamingLimit) * 100);
      
      // Get user count
      const userCount = await this.userModel.countDocuments({ schools: schoolId });
      const userLimit = plan.maxUsers + (subscription.approvedExtraResources?.extraUsers || 0);
      const userPercentage = Math.min(100, (userCount / userLimit) * 100);
      
      // Get courses per user (average)
      const courses = await this.courseModel.find({ school: schoolId });
      const coursePerUserLimit = plan.maxCoursesPerUser + 
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
          percentage: storagePercentage
        },
        
        streaming: {
          used: subscription.currentStreamingMinutes,
          limit: streamingLimit,
          percentage: streamingPercentage
        },
        
        users: {
          count: userCount,
          limit: userLimit,
          percentage: userPercentage
        },
        
        coursesPerUser: {
          limit: coursePerUserLimit
        },
        
        extraResourcesApproved: subscription.approvedExtraResources,
        monthlyUsage
      };
    } catch (error) {
      console.error('Error getting school subscription details:', error);
      return {
        error: 'Error al obtener detalles de suscripción de la escuela'
      };
    }
  }

  private async checkSchoolAccess(user: any, schoolId: string): Promise<boolean> {
    // Normalizar el ID del usuario
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
    const isTeacher = school.teachers && 
      school.teachers.some(teacherId => teacherId.toString() === userId);
    
    return isAdmin || isTeacher;
  }

  @Get('overview')
  @ApiOperation({ summary: 'Obtener estadísticas generales para el dashboard' })
  async getOverviewStats(@Request() req) {
    try {
      // Obtener información básica para el dashboard
      const dateRange = {
        startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        endDate: new Date()
      };

      // Obtener todas las métricas básicas en paralelo
      const [retentionRates, teacherPerformance, revenue] = await Promise.all([
        this.retentionService.getRetentionRatesByCourse(),
        this.performanceService.getTeachersPerformance(),
        this.revenueService.getRevenueMetrics(dateRange),
      ]);

      // Calcular resumen de estadísticas generales
      const totalStudents = retentionRates.reduce((sum, course) => sum + course.initialEnrollment, 0);
      const activeStudents = retentionRates.reduce((sum, course) => sum + course.currentEnrollment, 0);
      const totalCourses = retentionRates.length;
      const totalTeachers = teacherPerformance.length;
      
      return {
        usersCount: activeStudents,
        coursesCount: totalCourses,
        teachersCount: totalTeachers,
        totalRevenue: revenue.totalRevenue,
        retentionRate: activeStudents > 0 ? Math.round((activeStudents / totalStudents) * 100) : 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting overview stats:', error);
      return {
        usersCount: 0,
        coursesCount: 0,
        teachersCount: 0,
        totalRevenue: 0,
        retentionRate: 0,
        error: 'Error al obtener estadísticas de vista general'
      };
    }
  }

  @Get()
  @ApiOperation({ summary: 'Obtener estadísticas básicas del dashboard' })
  async getStats(@Query('schoolId') schoolId: string, @Request() req) {
    try {
      // Proporcionar datos básicos de estadísticas para el dashboard
      // Consultar modelos directamente para obtener datos reales
      let userQuery = {};
      let courseQuery = {};
      let classQuery = {};
      let schoolQuery = {};
      
      // Si se proporciona un ID de escuela, filtrar por esa escuela
      if (schoolId && schoolId !== 'all') {
        userQuery = { schools: schoolId };
        courseQuery = { school: schoolId };
        // Para las clases, necesitamos los IDs de los cursos de la escuela
        const schoolCourses = await this.courseModel.find({ school: schoolId }).select('_id');
        const courseIds = schoolCourses.map(course => course._id);
        classQuery = { course: { $in: courseIds } };
        schoolQuery = { _id: schoolId };
      }
      
      // Obtener recuentos directamente de la base de datos
      const [userCount, courseCount, classCount, schoolCount] = await Promise.all([
        this.userModel.countDocuments(userQuery),
        this.courseModel.countDocuments(courseQuery),
        this.classModel.countDocuments(classQuery),
        this.schoolModel.countDocuments(schoolQuery)
      ]);

      return {
        users: userCount,
        courses: courseCount,
        classes: classCount,
        schools: schoolCount || 1 // Asegurar que al menos hay una escuela
      };
    } catch (error) {
      console.error('Error getting basic stats:', error);
      return {
        users: 0,
        courses: 0,
        classes: 0,
        schools: 0,
        error: 'Error al obtener estadísticas básicas'
      };
    }
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SCHOOL_OWNER, UserRole.SUPER_ADMIN)
  @Get('all')
  @ApiOperation({ summary: 'Obtener todas las estadísticas' })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas correctamente', type: StatisticsResponseDto })
  async getAllStatistics(@Query() dateRange: DateRangeDto): Promise<StatisticsResponseDto> {
    // Establecer fechas por defecto si no se proporcionan
    if (!dateRange.startDate || !dateRange.endDate) {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - 1); // Último mes por defecto
      
      dateRange = {
        startDate,
        endDate
      };
    }
    
    // Obtener todas las métricas en paralelo
    const [
      retentionRates,
      teacherPerformance,
      revenue,
      dropoutRates,
      overallDropoutRate,
      ageDistribution
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
  @ApiOperation({ summary: 'Obtener tasas de retención por curso' })
  @ApiResponse({ status: 200, description: 'Tasas de retención obtenidas correctamente', type: [RetentionRateDto] })
  async getRetentionRates(): Promise<RetentionRateDto[]> {
    return this.retentionService.getRetentionRatesByCourse();
  }

  @Get('retention/:courseId')
  @ApiOperation({ summary: 'Obtener la tasa de retención para un curso específico' })
  @ApiParam({ name: 'courseId', description: 'ID del curso' })
  @ApiResponse({ status: 200, description: 'Tasa de retención obtenida correctamente', type: RetentionRateDto })
  async getRetentionRateForCourse(@Param('courseId') courseId: string): Promise<RetentionRateDto> {
    return this.retentionService.getRetentionRateForCourse(courseId);
  }

  @Get('performance')
  @ApiOperation({ summary: 'Obtener métricas de rendimiento de los profesores' })
  @ApiResponse({ status: 200, description: 'Métricas de rendimiento obtenidas correctamente', type: [TeacherPerformanceDto] })
  async getTeachersPerformance(): Promise<TeacherPerformanceDto[]> {
    return this.performanceService.getTeachersPerformance();
  }

  @Get('performance/:teacherId')
  @ApiOperation({ summary: 'Obtener métricas de rendimiento para un profesor específico' })
  @ApiParam({ name: 'teacherId', description: 'ID del profesor' })
  @ApiResponse({ status: 200, description: 'Métricas de rendimiento obtenidas correctamente', type: TeacherPerformanceDto })
  async getTeacherPerformance(@Param('teacherId') teacherId: string): Promise<TeacherPerformanceDto> {
    return this.performanceService.getTeacherPerformance(teacherId);
  }

  @Post('revenue')
  @ApiOperation({ summary: 'Obtener métricas de ingresos en un rango de fechas' })
  @ApiBody({ type: DateRangeDto })
  @ApiResponse({ status: 200, description: 'Métricas de ingresos obtenidas correctamente', type: RevenueDto })
  async getRevenueMetrics(@Body() dateRange: DateRangeDto): Promise<RevenueDto> {
    return this.revenueService.getRevenueMetrics(dateRange);
  }

  @Get('revenue/monthly')
  @ApiOperation({ summary: 'Obtener ingresos mensuales para el año actual' })
  @ApiResponse({ status: 200, description: 'Ingresos mensuales obtenidos correctamente' })
  async getMonthlyRevenue(): Promise<any> {
    return this.revenueService.getMonthlyRevenue();
  }

  @Get('revenue/courses')
  @ApiOperation({ summary: 'Obtener ingresos agrupados por curso' })
  @ApiResponse({ status: 200, description: 'Ingresos por curso obtenidos correctamente' })
  async getRevenueByCourse(): Promise<any> {
    return this.revenueService.getRevenueByCourse();
  }

  @Get('dropout')
  @ApiOperation({ summary: 'Obtener tasas de abandono por curso' })
  @ApiResponse({ status: 200, description: 'Tasas de abandono obtenidas correctamente', type: [DropoutRateDto] })
  async getDropoutRates(): Promise<DropoutRateDto[]> {
    return this.dropoutService.getDropoutRatesByCourse();
  }

  @Get('dropout/overall')
  @ApiOperation({ summary: 'Obtener la tasa de abandono global' })
  @ApiResponse({ status: 200, description: 'Tasa de abandono global obtenida correctamente' })
  async getOverallDropoutRate(): Promise<number> {
    return this.dropoutService.getOverallDropoutRate();
  }

  @Get('dropout/:courseId')
  @ApiOperation({ summary: 'Obtener detalles de abandono para un curso específico' })
  @ApiParam({ name: 'courseId', description: 'ID del curso' })
  @ApiResponse({ status: 200, description: 'Detalles de abandono obtenidos correctamente', type: DropoutRateDto })
  async getCourseDropoutDetails(@Param('courseId') courseId: string): Promise<DropoutRateDto> {
    return this.dropoutService.getCourseDropoutDetails(courseId);
  }

  @Get('demographics/age')
  @ApiOperation({ summary: 'Obtener distribución de estudiantes por edad' })
  @ApiResponse({ status: 200, description: 'Distribución de edades obtenida correctamente', type: AgeDistributionDto })
  async getAgeDistribution(): Promise<AgeDistributionDto> {
    return this.demographicsService.getAgeDistribution();
  }

  @Get('demographics/age/courses')
  @ApiOperation({ summary: 'Obtener distribución de edades por curso' })
  @ApiResponse({ status: 200, description: 'Distribución de edades por curso obtenida correctamente' })
  async getAgeDistributionByCourse(): Promise<any> {
    return this.demographicsService.getAgeDistributionByCourse();
  }
} 