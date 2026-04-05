import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/enums/user-role.enum';
import { BulkUploadConfig } from './bulk-upload.service';
import { BulkUploadFacade } from './services/bulk-upload.facade';

@Controller('bulk-upload')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
  UserRole.ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_OWNER,
  UserRole.ADMINISTRATIVE,
)
export class BulkUploadController {
  constructor(
    private readonly bulkUploadFacade: BulkUploadFacade,
  ) {}

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
    return this.bulkUploadFacade.parseExcel(file);
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
    return this.bulkUploadFacade.processBulkUpload(file, config, req);
  }

  @Get('template')
  async downloadTemplate() {
    return this.bulkUploadFacade.getTemplate();
  }
}
