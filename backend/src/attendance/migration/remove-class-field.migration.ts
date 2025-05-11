import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attendance, AttendanceDocument } from '../schemas/attendance.schema';

@Injectable()
export class RemoveClassFieldMigration {
  private readonly logger = new Logger(RemoveClassFieldMigration.name);

  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<AttendanceDocument>,
  ) {}

  /**
   * Migrate attendance records to remove class field
   */
  async migrate(): Promise<void> {
    this.logger.log('Starting migration to remove class field from attendance records');
    
    try {
      // Use updateMany to remove the class field from all documents
      const result = await this.attendanceModel.updateMany(
        {}, // Match all documents
        { $unset: { class: "" } } // Remove the class field
      );
      
      this.logger.log(`Successfully updated ${result.modifiedCount} attendance records`);
    } catch (error) {
      this.logger.error(`Error during migration: ${error.message}`, error.stack);
      throw error;
    }
  }
} 