import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School, SchoolDocument } from '../../schools/schemas/school.schema';
import { Plan, PlanDocument, PlanType } from '../../plans/schemas/plan.schema';

@Injectable()
export class SetDefaultPlansMigration {
  constructor(
    @InjectModel(School.name) private schoolModel: Model<SchoolDocument>,
    @InjectModel(Plan.name) private planModel: Model<PlanDocument>
  ) {}

  async up(): Promise<void> {
    console.log('Starting migration: Assigning Basic plan to existing academies...');

    // Find the Basic plan
    const basicPlan = await this.planModel.findOne({ 
      type: PlanType.BASIC, 
      isActive: true 
    }).exec();

    if (!basicPlan) {
      throw new Error('Basic plan not found. Please ensure plans are initialized first.');
    }

    // Find all schools without a planId
    const schoolsWithoutPlan = await this.schoolModel.find({
      $or: [
        { planId: { $exists: false } },
        { planId: null }
      ]
    }).exec();

    console.log(`Found ${schoolsWithoutPlan.length} academies without assigned plans`);

    // Update each school with Basic plan and default values
    for (const school of schoolsWithoutPlan) {
      // Count current users (seats)
      const currentSeats = school.students.length + school.teachers.length + school.administratives.length;

      await this.schoolModel.findByIdAndUpdate(school._id, {
        planId: basicPlan._id,
        extraSeats: 0,
        extraStorageGB: 0,
        extraStreamingHours: 0,
        currentSeats: currentSeats,
        usedStorageGB: school.storageUsedGb || 0, // Use existing value or 0
        usedStreamingHours: 0 // Reset streaming hours
      }).exec();

      console.log(`Updated academy ${school.name} with Basic plan (${currentSeats} current seats)`);
    }

    console.log('Migration completed: All academies now have assigned plans');
  }

  async down(): Promise<void> {
    console.log('Rolling back: Removing planId from all academies...');

    await this.schoolModel.updateMany({}, {
      $unset: { 
        planId: 1,
        extraSeats: 1,
        extraStorageGB: 1,
        extraStreamingHours: 1,
        currentSeats: 1,
        usedStorageGB: 1,
        usedStreamingHours: 1
      }
    }).exec();

    console.log('Rollback completed');
  }
} 