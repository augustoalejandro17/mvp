import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Plan, PlanDocument, PlanType } from './schemas/plan.schema';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>
  ) {
    // Inicializar planes predeterminados si no existen
    this.initDefaultPlans();
  }

  async initDefaultPlans() {
    const plansCount = await this.planModel.countDocuments().exec();
    
    if (plansCount === 0) {
      const defaultPlans = [
        {
          name: 'Plan Básico',
          type: PlanType.BASIC,
          description: 'Para academias pequeñas o que recién comienzan',
          maxUsers: 20,
          maxStorageGb: 10,
          maxStreamingMinutesPerMonth: 5000,
          maxCoursesPerUser: 1,
          monthlyPrice: 29.99,
          isDefault: true,
          extraUserPrice: 2.99,
          extraStorageGbPrice: 1.49,
          extraStreamingMinutesPrice: 0.005, // por minuto
          extraCoursePerUserPrice: 5.99
        },
        {
          name: 'Plan Intermedio',
          type: PlanType.INTERMEDIATE,
          description: 'Para academias en crecimiento',
          maxUsers: 60,
          maxStorageGb: 50,
          maxStreamingMinutesPerMonth: 15000,
          maxCoursesPerUser: 2,
          monthlyPrice: 69.99,
          isDefault: false,
          extraUserPrice: 2.49,
          extraStorageGbPrice: 0.99,
          extraStreamingMinutesPrice: 0.004, // por minuto
          extraCoursePerUserPrice: 4.99
        },
        {
          name: 'Plan Avanzado',
          type: PlanType.ADVANCED,
          description: 'Para academias establecidas',
          maxUsers: 125,
          maxStorageGb: 100,
          maxStreamingMinutesPerMonth: 30000,
          maxCoursesPerUser: 3,
          monthlyPrice: 119.99,
          isDefault: false,
          extraUserPrice: 1.99,
          extraStorageGbPrice: 0.79,
          extraStreamingMinutesPrice: 0.003, // por minuto
          extraCoursePerUserPrice: 3.99
        },
        {
          name: 'Plan Premium',
          type: PlanType.PREMIUM,
          description: 'Para academias grandes y consolidadas',
          maxUsers: 400,
          maxStorageGb: 500,
          maxStreamingMinutesPerMonth: 100000,
          maxCoursesPerUser: 4,
          monthlyPrice: 299.99,
          isDefault: false,
          extraUserPrice: 1.49,
          extraStorageGbPrice: 0.59,
          extraStreamingMinutesPrice: 0.002, // por minuto
          extraCoursePerUserPrice: 2.99
        },
      ];
      
      await this.planModel.insertMany(defaultPlans);
    }
  }

  async create(createPlanDto: CreatePlanDto): Promise<Plan> {
    const createdPlan = new this.planModel(createPlanDto);
    return createdPlan.save();
  }

  async findAll(): Promise<Plan[]> {
    return this.planModel.find({ isActive: true }).exec();
  }

  async findOne(id: string): Promise<Plan> {
    return this.planModel.findById(id).exec();
  }

  async findDefault(): Promise<Plan> {
    return this.planModel.findOne({ isDefault: true, isActive: true }).exec();
  }

  async findByType(type: PlanType): Promise<Plan> {
    return this.planModel.findOne({ type, isActive: true }).exec();
  }

  async update(id: string, updatePlanDto: UpdatePlanDto): Promise<Plan> {
    return this.planModel.findByIdAndUpdate(id, updatePlanDto, { new: true }).exec();
  }

  async remove(id: string): Promise<any> {
    // En lugar de eliminar, marcamos como inactivo
    return this.planModel.findByIdAndUpdate(id, { isActive: false }, { new: true }).exec();
  }
} 