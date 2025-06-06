import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { School } from '../schools/schemas/school.schema';

@Injectable()
export class MigrationService implements OnModuleInit {
  private readonly logger = new Logger(MigrationService.name);

  constructor(
    @InjectModel(School.name) private schoolModel: Model<School>,
  ) {}

  async onModuleInit() {
    await this.runMigrations();
  }

  private async runMigrations() {
    try {
      await this.addTimezoneToSchools();
    } catch (error) {
      this.logger.error('Error running migrations:', error);
    }
  }

  private async addTimezoneToSchools() {
    try {
      // Check if any schools are missing the timezone field
      const schoolsWithoutTimezone = await this.schoolModel.countDocuments({
        timezone: { $exists: false }
      });

      if (schoolsWithoutTimezone === 0) {
        this.logger.log('All schools already have timezone field');
        return;
      }

      // Add timezone field to schools that don't have it
      const result = await this.schoolModel.updateMany(
        { timezone: { $exists: false } },
        { $set: { timezone: 'America/Bogota' } }
      );

      this.logger.log(`Migration: Added timezone field to ${result.modifiedCount} schools`);

      // Verify the update
      const totalSchoolsWithTimezone = await this.schoolModel.countDocuments({
        timezone: { $exists: true }
      });
      
      this.logger.log(`Total schools with timezone field: ${totalSchoolsWithTimezone}`);
      
    } catch (error) {
      this.logger.error('Error in addTimezoneToSchools migration:', error);
    }
  }
} 