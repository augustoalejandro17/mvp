import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../auth/schemas/user.schema';
import { School } from '../schools/schemas/school.schema';
import { Course } from '../courses/schemas/course.schema';
import { Class } from '../classes/schemas/class.schema';
import { Subscription } from '../plans/schemas/subscription.schema';
import { Plan } from '../plans/schemas/plan.schema';
import { UserRole } from '../auth/schemas/user.schema';

@Injectable()
export class AdminStatsFacade {
  private readonly logger = new Logger(AdminStatsFacade.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Course.name) private courseModel: Model<Course>,
    @InjectModel(Class.name) private classModel: Model<Class>,
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    @InjectModel(Plan.name) private planModel: Model<Plan>,
  ) {}

  async getStatsForUser(user: any, schoolId?: string) {
    try {
      const userId = user.sub || (user._id ? user._id.toString() : null);
      if (!userId) {
        throw new UnauthorizedException('ID de usuario no disponible');
      }

      const stats: any = {};

      if (schoolId && schoolId !== 'all') {
        const hasAccess = await this.checkSchoolAccess(user, schoolId);
        if (!hasAccess) {
          throw new ForbiddenException('Acceso denegado a la escuela');
        }

        stats.users = await this.getUserCountForSchool(schoolId);
        stats.students = await this.getUserCountByRoleForSchool(
          schoolId,
          UserRole.STUDENT,
        );
        stats.teachers = await this.getTeacherCountForSchool(schoolId);
        stats.schools = 1;
        stats.courses = await this.getCourseCountForSchool(schoolId);
        stats.classes = await this.getClassCountForSchool(schoolId);

        return stats;
      }

      if (user.role === UserRole.SUPER_ADMIN) {
        stats.users = await this.userModel.countDocuments();
        stats.students = await this.userModel.countDocuments({
          $or: [
            { role: UserRole.STUDENT },
            { 'schoolRoles.role': UserRole.STUDENT },
          ],
        });
        stats.teachers = await this.userModel.countDocuments({
          $or: [
            { role: UserRole.TEACHER },
            { 'schoolRoles.role': UserRole.TEACHER },
          ],
        });
        stats.schools = await this.schoolModel.countDocuments();
        stats.courses = await this.courseModel.countDocuments();
        stats.classes = await this.classModel.countDocuments();
        return stats;
      }

      let schoolIds: any[] = [];

      if (user.role === UserRole.SCHOOL_OWNER) {
        const ownedSchools = await this.schoolModel.find({ admin: userId });
        schoolIds = ownedSchools.map((school) => school._id);
      } else if (user.role === UserRole.ADMIN) {
        const adminSchools = await this.schoolModel.find({
          teachers: userId,
        });
        schoolIds = adminSchools.map((school) => school._id);
      } else if (user.role === UserRole.ADMINISTRATIVE) {
        const userDoc = await this.userModel.findById(userId);
        const userAdministratedSchools = userDoc?.administratedSchools || [];

        const administrativeSchools = await this.schoolModel.find({
          $or: [
            { administratives: userId },
            { teachers: userId },
            { _id: { $in: userAdministratedSchools } },
          ],
        });
        schoolIds = administrativeSchools.map((school) => school._id);
      }

      stats.users = await this.getUserCountForSchools(schoolIds);
      stats.students = await this.getUserCountByRoleForSchools(
        schoolIds,
        UserRole.STUDENT,
      );
      stats.teachers = await this.getTeacherCountForSchools(schoolIds);
      stats.schools = schoolIds.length;
      stats.courses = await this.getCourseCountForSchools(schoolIds);
      stats.classes = await this.getClassCountForSchools(schoolIds);

      return stats;
    } catch (error) {
      this.logger.error(`Error getting stats: ${error.message}`, error.stack);
      if (error?.getStatus) {
        throw error;
      }
      throw new InternalServerErrorException('Error al obtener estadísticas');
    }
  }

  async getSubscriptionsStats() {
    try {
      const totalSubscriptions = await this.subscriptionModel.countDocuments();
      const activePlans = await this.planModel.countDocuments({
        isActive: true,
      });

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

      const subscriptionsByStatus = await this.subscriptionModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);

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

  async getSchoolSubscriptionDetails(schoolId: string, user: any) {
    try {
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

      const subscription = await this.subscriptionModel
        .findById(school.activeSubscription)
        .populate('plan');

      if (!subscription) {
        throw new NotFoundException('Suscripción no encontrada');
      }

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

      const userCount = await this.getUserCountForSchool(schoolId);
      const userLimit =
        plan.maxUsers + (subscription.approvedExtraResources?.extraUsers || 0);
      const userPercentage = Math.min(100, (userCount / userLimit) * 100);

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
          limit:
            plan.maxCoursesPerUser +
            (subscription.approvedExtraResources?.extraCoursesPerUser || 0),
        },
        extraResourcesApproved: subscription.approvedExtraResources,
        monthlyUsage: subscription.usageHistory || [],
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
    const school = await this.schoolModel.findById(schoolId);
    if (!school) {
      return false;
    }

    const isAdmin = school.admin && school.admin.toString() === userId;
    const isTeacher =
      school.teachers &&
      school.teachers.some((teacherId) => teacherId.toString() === userId);
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

  private async getUserCountByRoleForSchool(
    schoolId: string,
    role: UserRole,
  ): Promise<number> {
    return this.userModel.countDocuments({
      $and: [
        {
          $or: [
            { schools: schoolId },
            {
              schoolRoles: {
                $elemMatch: {
                  schoolId,
                },
              },
            },
          ],
        },
        {
          $or: [
            { role },
            {
              schoolRoles: {
                $elemMatch: {
                  schoolId,
                  role,
                },
              },
            },
          ],
        },
      ],
    });
  }

  private async getUserCountByRoleForSchools(
    schoolIds: any[],
    role: UserRole,
  ): Promise<number> {
    return this.userModel.countDocuments({
      $and: [
        {
          $or: [
            { schools: { $in: schoolIds } },
            {
              'schoolRoles.schoolId': { $in: schoolIds },
            },
          ],
        },
        {
          $or: [
            { role },
            {
              'schoolRoles.role': role,
            },
          ],
        },
      ],
    });
  }

  private async getTeacherCountForSchool(schoolId: string): Promise<number> {
    return this.getUserCountByRoleForSchool(schoolId, UserRole.TEACHER);
  }

  private async getTeacherCountForSchools(schoolIds: any[]): Promise<number> {
    return this.getUserCountByRoleForSchools(schoolIds, UserRole.TEACHER);
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
