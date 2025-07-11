import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Req,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { BulkUploadService, BulkUploadConfig } from './bulk-upload.service';
import { getUserIdFromRequest } from '../utils/token-handler';

@Controller('bulk-upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_OWNER,
  UserRole.ADMINISTRATIVE,
)
export class BulkUploadController {
  private readonly logger = new Logger(BulkUploadController.name);

  constructor(private readonly bulkUploadService: BulkUploadService) {}

  @Post('parse-excel')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
          return callback(
            new BadRequestException('Only Excel files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async parseExcel(@UploadedFile() file: Express.Multer.File) {
    this.logger.log(`Parsing Excel file: ${file.originalname}`);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const parsedData = await this.bulkUploadService.parseExcelFile(
        file.buffer,
      );

      return {
        success: true,
        totalRows: parsedData.length,
        data: parsedData.slice(0, 10), // Return first 10 rows for preview
        preview: true,
        message: `Successfully parsed ${parsedData.length} rows. Review the data before processing.`,
      };
    } catch (error) {
      this.logger.error(
        `Error parsing Excel file: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('process')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
      fileFilter: (req, file, callback) => {
        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
          return callback(
            new BadRequestException('Only Excel files are allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async processBulkUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body() config: BulkUploadConfig,
    @Req() req,
  ) {
    this.logger.log(`Processing bulk upload for school: ${config.schoolId}`);

    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    if (!config.schoolId) {
      throw new BadRequestException('School ID is required');
    }

    try {
      const adminUserId = getUserIdFromRequest(req);

      // Parse the Excel file
      const parsedData = await this.bulkUploadService.parseExcelFile(
        file.buffer,
      );

      // Process the bulk upload
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
    } catch (error) {
      this.logger.error(
        `Error processing bulk upload: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('template')
  async downloadTemplate() {
    // Return information about the expected Excel format
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
