import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
  Patch,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { Request, Response } from 'express';
import { PermissionsGuard, Permission } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RecordAttendanceDto } from './dto/record-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { videoFileFilter } from './video-upload.utils';
import { ClassVideoService } from './class-video.service';

@Controller('classes')
export class ClassesController {
  constructor(
    private readonly classesService: ClassesService,
    private readonly classVideoService: ClassVideoService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async findAll(@Req() req, @Query('courseId') courseId?: string) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    return this.classesService.findAll(userId, user?.role, courseId);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req) {
    const user = req.user as any;
    const userId = user?._id || user?.sub;
    const userRole = user?.role;
    return this.classesService.findOne(id, userId, userRole);
  }

  @Get(':id/stream-url')
  @UseGuards(OptionalJwtAuthGuard)
  async getStreamingUrl(
    @Param('id') id: string,
    @Req() req,
    @Query('direct') direct?: string,
  ) {
    return this.classVideoService.getStreamingUrlPayload(id, req, direct);
  }

  @Get(':id/video-proxy')
  @UseGuards(OptionalJwtAuthGuard)
  async streamVideo(@Param('id') id: string, @Req() req, @Res() res: Response) {
    return this.classVideoService.streamVideoProxy(id, req, res);
  }

  @Get(':id/download-url')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN)
  async getDownloadUrl(@Param('id') id: string) {
    return this.classVideoService.getDownloadUrlPayload(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.TEACHER,
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.SCHOOL_OWNER,
    UserRole.ADMINISTRATIVE,
  )
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 200 * 1024 * 1024, // 200MB para soportar videos más grandes
      },
      fileFilter: videoFileFilter,
    }),
  )
  async create(
    @UploadedFile() file: Express.Multer.File,
    @Body() createClassDto: CreateClassDto,
    @Req() req,
  ) {
    const userId = req.user.sub || req.user._id?.toString();
    return this.classesService.createForRequest(createClassDto, userId, file);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('video', {
      limits: {
        fileSize: 200 * 1024 * 1024, // 200MB para soportar videos más grandes
      },
      fileFilter: videoFileFilter,
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() updateClassDto: UpdateClassDto,
    @Req() req: Request,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const user = req.user as any;
    const userId = user._id || user.sub;
    return this.classesService.updateForRequest(id, updateClassDto, userId, file);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as any;
    const userId = user._id || user.sub;
    return this.classesService.removeForRequest(id, userId);
  }

  @Post(':id/attendance')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.TAKE_ATTENDANCE)
  async recordAttendance(
    @Param('id') classId: string,
    @Body() recordAttendanceDto: RecordAttendanceDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.classesService.recordAttendance(
      classId,
      recordAttendanceDto,
      userId,
    );
  }

  @Get(':id/attendance')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.VIEW_ATTENDANCE)
  async getAttendance(
    @Param('id') classId: string,
    @Query('date') date?: string,
    @Query('start') start?: string,
    @Query('end') end?: string,
  ) {
    return this.classesService.getAttendance(classId, date, start, end);
  }

  @Get(':id/attendance/student/:studentId')
  @UseGuards(JwtAuthGuard)
  async getStudentAttendance(
    @Param('id') classId: string,
    @Param('studentId') studentId: string,
    @Req() req,
  ) {
    return this.classesService.getStudentAttendanceForRequester(
      classId,
      studentId,
      req.user.sub,
      req.user.role,
    );
  }

  @Patch(':id/attendance/:attendanceId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.UPDATE_ATTENDANCE)
  async updateAttendance(
    @Param('id') classId: string,
    @Param('attendanceId') attendanceId: string,
    @Body() updateAttendanceDto: UpdateAttendanceDto,
    @Req() req,
  ) {
    const userId = req.user.sub;
    return this.classesService.updateAttendance(
      classId,
      attendanceId,
      updateAttendanceDto,
      userId,
    );
  }

  @Delete(':id/attendance/:attendanceId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELETE_ATTENDANCE)
  async deleteAttendance(
    @Param('id') classId: string,
    @Param('attendanceId') attendanceId: string,
  ) {
    return this.classesService.deleteAttendance(classId, attendanceId);
  }
}
