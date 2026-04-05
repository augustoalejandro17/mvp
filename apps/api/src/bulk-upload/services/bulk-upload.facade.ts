import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import {
  BulkUploadConfig,
  BulkUploadService,
} from '../bulk-upload.service';
import { getUserIdFromRequest } from '../../utils/token-handler';

@Injectable()
export class BulkUploadFacade {
  private readonly logger = new Logger(BulkUploadFacade.name);

  constructor(private readonly bulkUploadService: BulkUploadService) {}

  async parseExcel(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    this.logger.log(`Parsing Excel file: ${file.originalname}`);

    const parsedData = await this.bulkUploadService.parseExcelFile(file.buffer);

    return {
      success: true,
      totalRows: parsedData.length,
      data: parsedData.slice(0, 10),
      preview: true,
      message: `Successfully parsed ${parsedData.length} rows. Review the data before processing.`,
    };
  }

  async processBulkUpload(
    file: Express.Multer.File,
    config: BulkUploadConfig,
    req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!config.schoolId) {
      throw new BadRequestException('School ID is required');
    }

    this.logger.log(`Processing bulk upload for school: ${config.schoolId}`);

    const adminUserId = getUserIdFromRequest(req);
    const parsedData = await this.bulkUploadService.parseExcelFile(file.buffer);
    const result = await this.bulkUploadService.processBulkUpload(
      parsedData,
      config,
      adminUserId,
    );

    return {
      success: true,
      result,
      message: `Bulk upload completed: ${result.successCount}/${result.totalRows} rows processed successfully`,
    };
  }

  getTemplate() {
    return {
      success: true,
      templateInfo: {
        requiredColumns: ['CURSO', 'PROFESOR', 'ESTUDIANTE'],
        optionalColumns: ['EDAD', 'CORREO', 'CELULAR', 'ESTADO'],
        instructions: [
          'The first row should contain column headers',
          'CURSO: Name of the course',
          'PROFESOR: Teacher name',
          'ESTUDIANTE: Student name',
          'EDAD: Student age (optional)',
          'CORREO: Student email (optional)',
          'CELULAR: Student phone (optional)',
          'ESTADO: Student status (optional)',
        ],
        example: {
          CURSO: 'BABY DANCE',
          PROFESOR: 'BELUS MAGGI',
          ESTUDIANTE: 'MAITE PINOS',
          EDAD: 6,
          CORREO: 'student@example.com',
          CELULAR: '123456789',
          ESTADO: 'ANTIGUO',
        },
      },
    };
  }
}
