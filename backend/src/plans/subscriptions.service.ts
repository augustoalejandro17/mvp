import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subscription, SubscriptionDocument, SubscriptionStatus } from './schemas/subscription.schema';
import { Plan, PlanDocument } from './schemas/plan.schema';
import { School, SchoolDocument } from '../schools/schemas/school.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectModel(Subscription.name) private subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>,
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>
  ) {}

  async create(createSubscriptionDto: CreateSubscriptionDto): Promise<Subscription> {
    // Validar que la escuela existe
    const school = await this.schoolModel.findById(createSubscriptionDto.school).exec();
    if (!school) {
      throw new NotFoundException('Escuela no encontrada');
    }

    // Validar que el plan existe
    const plan = await this.planModel.findById(createSubscriptionDto.plan).exec();
    if (!plan) {
      throw new NotFoundException('Plan no encontrado');
    }

    // Verificar si ya existe una suscripción activa para esta escuela
    const existingSubscription = await this.subscriptionModel.findOne({
      school: createSubscriptionDto.school,
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
    }).exec();

    if (existingSubscription) {
      throw new BadRequestException('La escuela ya tiene una suscripción activa');
    }

    // Crear la suscripción
    const newSubscription = new this.subscriptionModel({
      ...createSubscriptionDto,
      startDate: new Date(),
      status: SubscriptionStatus.ACTIVE,
      approvedExtraResources: {
        extraUsers: 0,
        extraStorageGb: 0,
        extraStreamingMinutes: 0,
        extraCoursesPerUser: 0
      },
      usageHistory: [{
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        usedStorageGb: 0,
        usedStreamingMinutes: 0,
        activeUsers: 0,
        extraUsage: {
          extraUsers: 0,
          extraStorageGb: 0,
          extraStreamingMinutes: 0,
          extraCoursesPerUser: 0
        }
      }]
    });

    const savedSubscription = await newSubscription.save();

    // Actualizar la escuela con la suscripción activa
    await this.schoolModel.findByIdAndUpdate(
      createSubscriptionDto.school,
      { activeSubscription: savedSubscription._id }
    ).exec();

    return savedSubscription;
  }

  async findAll(): Promise<Subscription[]> {
    return this.subscriptionModel.find()
      .populate('plan')
      .populate('school')
      .exec();
  }

  async findOne(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel.findById(id)
      .populate('plan')
      .populate('school')
      .exec();
    
    if (!subscription) {
      throw new NotFoundException('Suscripción no encontrada');
    }
    
    return subscription;
  }

  async findBySchool(schoolId: string): Promise<Subscription> {
    const subscription = await this.subscriptionModel.findOne({
      school: schoolId,
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
    })
    .populate('plan')
    .exec();
    
    if (!subscription) {
      throw new NotFoundException('La escuela no tiene una suscripción activa');
    }
    
    return subscription;
  }

  async update(id: string, updateSubscriptionDto: UpdateSubscriptionDto): Promise<Subscription> {
    const subscription = await this.subscriptionModel.findById(id).exec();
    
    if (!subscription) {
      throw new NotFoundException('Suscripción no encontrada');
    }
    
    return this.subscriptionModel.findByIdAndUpdate(id, updateSubscriptionDto, { new: true })
      .populate('plan')
      .populate('school')
      .exec();
  }

  async remove(id: string): Promise<any> {
    const subscription = await this.subscriptionModel.findById(id).exec();
    
    if (!subscription) {
      throw new NotFoundException('Suscripción no encontrada');
    }
    
    // En lugar de eliminar, cambiamos el estado a cancelado
    subscription.status = SubscriptionStatus.CANCELED;
    subscription.endDate = new Date();
    await subscription.save();
    
    // Actualizar la referencia en la escuela
    await this.schoolModel.findByIdAndUpdate(
      subscription.school,
      { $unset: { activeSubscription: 1 } }
    ).exec();
    
    return { message: 'Suscripción cancelada correctamente' };
  }

  async canAddUserToSchool(schoolId: string): Promise<{ canAdd: boolean, available: number, message: string }> {
    try {
      // Buscar la escuela
      const school = await this.schoolModel.findById(schoolId).exec();
      if (!school) {
        return { canAdd: false, available: 0, message: 'Escuela no encontrada' };
      }

      // Buscar la suscripción activa
      const subscription = await this.findSubscriptionForSchool(schoolId);
      if (!subscription) {
        return { canAdd: false, available: 0, message: 'La escuela no tiene una suscripción activa' };
      }

      // Obtener el plan asociado a la suscripción
      const plan = await this.planModel.findById(subscription.plan).exec();
      if (!plan) {
        return { canAdd: false, available: 0, message: 'Plan no encontrado' };
      }

      // Contar usuarios totales de la escuela
      const totalUsers = school.students.length + school.teachers.length + school.administratives.length;
      
      // Calcular límite total (plan base + extras aprobados)
      const userLimit = plan.maxUsers + (subscription.approvedExtraResources?.extraUsers || 0);
      
      // Verificar si hay espacio disponible
      const available = Math.max(0, userLimit - totalUsers);
      const canAdd = available > 0;
      
      return {
        canAdd,
        available,
        message: canAdd 
          ? `Se pueden agregar hasta ${available} usuarios más`
          : 'Se ha alcanzado el límite de usuarios permitidos por el plan'
      };
    } catch (error) {
      return { 
        canAdd: false, 
        available: 0, 
        message: `Error al verificar cuota de usuarios: ${error.message}` 
      };
    }
  }

  async canEnrollUserToCourse(userId: string, courseId: string): Promise<{ canEnroll: boolean, message: string }> {
    try {
      // Buscar el usuario
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        return { canEnroll: false, message: 'Usuario no encontrado' };
      }

      // Buscar el curso
      const course = await this.courseModel.findById(courseId).exec();
      if (!course) {
        return { canEnroll: false, message: 'Curso no encontrado' };
      }

      // Buscar la escuela del curso
      const school = await this.schoolModel.findOne({ courses: { $in: [courseId] } }).exec();
      if (!school) {
        return { canEnroll: false, message: 'Escuela no encontrada para este curso' };
      }

      // Buscar la suscripción activa de la escuela
      const subscription = await this.findSubscriptionForSchool(school._id.toString());
      if (!subscription) {
        return { canEnroll: false, message: 'La escuela no tiene una suscripción activa' };
      }

      // Obtener el plan asociado a la suscripción
      const plan = await this.planModel.findById(subscription.plan).exec();
      if (!plan) {
        return { canEnroll: false, message: 'Plan no encontrado' };
      }

      // Contar cuántos cursos de esta escuela tiene el usuario
      const userCourses = await this.courseModel.find({
        _id: { $in: user.enrolledCourses },
        school: school._id
      }).exec();
      
      const schoolCourseCount = userCourses.length;

      // Calcular límite total (plan base + extras aprobados)
      const courseLimit = plan.maxCoursesPerUser + 
        (subscription.approvedExtraResources?.extraCoursesPerUser || 0);
      
      // Verificar si hay espacio disponible
      const canEnroll = schoolCourseCount < courseLimit;
      
      return {
        canEnroll,
        message: canEnroll 
          ? 'El usuario puede inscribirse en este curso'
          : `El usuario ya está inscrito en el máximo de cursos permitidos (${courseLimit}) para esta escuela`
      };
    } catch (error) {
      return { 
        canEnroll: false, 
        message: `Error al verificar límite de cursos por usuario: ${error.message}` 
      };
    }
  }

  // Utilidad para obtener la suscripción activa de una escuela
  private async findSubscriptionForSchool(schoolId: string): Promise<Subscription | null> {
    const objectId = Types.ObjectId.isValid(schoolId) 
      ? new Types.ObjectId(schoolId)
      : null;
    
    if (!objectId) {
      return null;
    }
    
    const school = await this.schoolModel.findById(objectId).exec();
    if (!school || !school.activeSubscription) {
      return null;
    }
    
    return this.subscriptionModel.findOne({
      _id: school.activeSubscription,
      status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] }
    }).exec();
  }

  // Método para actualizar el uso de almacenamiento
  async updateStorageUsage(schoolId: string, additionalStorageGb: number): Promise<boolean> {
    try {
      const school = await this.schoolModel.findById(schoolId).exec();
      if (!school) {
        throw new NotFoundException('Escuela no encontrada');
      }
      
      const subscription = await this.findSubscriptionForSchool(schoolId);
      if (!subscription) {
        throw new NotFoundException('La escuela no tiene una suscripción activa');
      }
      
      const plan = await this.planModel.findById(subscription.plan).exec();
      if (!plan) {
        throw new NotFoundException('Plan no encontrado');
      }
      
      // Actualizar el uso de almacenamiento de la escuela
      const newStorageUsed = (school.storageUsedGb || 0) + additionalStorageGb;
      await this.schoolModel.findByIdAndUpdate(
        schoolId,
        { storageUsedGb: newStorageUsed }
      ).exec();
      
      // Actualizar el uso de almacenamiento en la suscripción
      subscription.currentStorageGb = newStorageUsed;
      
      // Obtener la fecha actual para el historial mensual
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();
      
      // Preparar la actualización mensual
      let usageHistory = [...(subscription.usageHistory || [])];
      const monthIndex = usageHistory.findIndex(
        history => history.month === currentMonth && history.year === currentYear
      );
      
      if (monthIndex !== -1) {
        // Actualizar el registro existente
        usageHistory[monthIndex].usedStorageGb = newStorageUsed;
        usageHistory[monthIndex].lastUpdated = currentDate;
      } else {
        // Crear un nuevo registro mensual
        usageHistory.push({
          month: currentMonth,
          year: currentYear,
          usedStorageGb: newStorageUsed,
          usedStreamingMinutes: 0,
          activeUsers: 0,
          extraUsage: {
            extraUsers: 0,
            extraStorageGb: 0,
            extraStreamingMinutes: 0,
            extraCoursesPerUser: 0
          },
          lastUpdated: currentDate
        });
      }
      
      // Actualizar la suscripción usando el método update de Mongoose
      await this.subscriptionModel.updateOne(
        { _id: subscription['_id'] },
        { 
          currentStorageGb: newStorageUsed,
          usageHistory: usageHistory,
          lastUpdated: currentDate
        }
      ).exec();
      
      // Comprobar si excede el límite
      const storageLimit = plan.maxStorageGb + 
        (subscription.approvedExtraResources?.extraStorageGb || 0);
      
      return newStorageUsed <= storageLimit;
    } catch (error) {
      console.error('Error al actualizar el uso de almacenamiento:', error);
      return false;
    }
  }

  // Método para verificar si hay espacio de almacenamiento disponible
  async hasAvailableStorage(schoolId: string, requiredGb: number): Promise<{
    hasSpace: boolean;
    available: number;
    message: string;
  }> {
    try {
      const school = await this.schoolModel.findById(schoolId).exec();
      if (!school) {
        return { 
          hasSpace: false, 
          available: 0, 
          message: 'Escuela no encontrada' 
        };
      }
      
      const subscription = await this.findSubscriptionForSchool(schoolId);
      if (!subscription) {
        return { 
          hasSpace: false, 
          available: 0, 
          message: 'La escuela no tiene una suscripción activa' 
        };
      }
      
      const plan = await this.planModel.findById(subscription.plan).exec();
      if (!plan) {
        return { 
          hasSpace: false, 
          available: 0, 
          message: 'Plan no encontrado' 
        };
      }
      
      const usedStorage = school.storageUsedGb || 0;
      const storageLimit = plan.maxStorageGb + 
        (subscription.approvedExtraResources?.extraStorageGb || 0);
      
      const available = Math.max(0, storageLimit - usedStorage);
      const hasSpace = requiredGb <= available;
      
      return {
        hasSpace,
        available,
        message: hasSpace 
          ? `Hay ${available.toFixed(2)}GB disponibles de los ${storageLimit}GB permitidos` 
          : `No hay suficiente espacio disponible. Se necesitan ${requiredGb}GB, pero solo quedan ${available.toFixed(2)}GB`
      };
    } catch (error) {
      return { 
        hasSpace: false, 
        available: 0, 
        message: `Error al verificar espacio de almacenamiento: ${error.message}` 
      };
    }
  }
} 