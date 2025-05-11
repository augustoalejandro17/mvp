import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, Logger, Delete, BadRequestException, UnauthorizedException, HttpException, HttpStatus, Request, NotFoundException } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';
import { Permission, RequirePermissions, PermissionsGuard } from '../auth/guards/permissions.guard';

@Controller('schools')
export class SchoolsController {
  private readonly logger = new Logger(SchoolsController.name);

  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req) {
    // Asegurarnos de obtener el ID de usuario correctamente, independientemente de la estructura
    const userId = req.user.sub || (req.user._id ? req.user._id.toString() : null);
    const userRole = req.user.role;
    
    this.logger.log(`Buscando escuelas para usuario: ${userId}, rol: ${userRole}`);
    
    return this.schoolsService.findAll(userId, userRole);
  }

  @Get('teacher/:id')
  @UseGuards(JwtAuthGuard)
  async findByTeacher(@Param('id') id: string, @Req() req) {
    
    const schools = await this.schoolsService.findAll(id, UserRole.TEACHER);
    
    return schools;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      
      throw new BadRequestException(`ID de escuela inválido: ${id}`);
    }
    
    
    try {
      return await this.schoolsService.findOne(id);
    } catch (error) {
      this.logger.error(`Error al obtener escuela con ID ${id}: ${error.message}`);
      throw error;
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.CREATE_SCHOOL)
  async create(@Body() createSchoolDto: CreateSchoolDto, @Req() req) {
    
    
    
    try {
      const result = await this.schoolsService.create(createSchoolDto, req.user._id);
      
      return result;
    } catch (error) {
      this.logger.error(`Error al crear escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.UPDATE_SCHOOL)
  async update(@Param('id') id: string, @Body() updateSchoolDto: any, @Req() req) {
    
    
    
    
    // Verificar formato del ID
    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      
      throw new BadRequestException(`ID de escuela inválido: ${id}`);
    }
    
    try {
      const result = await this.schoolsService.update(id, updateSchoolDto, req.user.sub || req.user._id);
      
      return result;
    } catch (error) {
      this.logger.error(`Error al actualizar escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/teachers/:teacherId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_TEACHERS)
  async addTeacher(@Param('id') id: string, @Param('teacherId') teacherId: string, @Req() req) {
    
    
    
    try {
      const result = await this.schoolsService.addTeacher(id, teacherId, req.user._id);
      
      return result;
    } catch (error) {
      this.logger.error(`Error al añadir profesor: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/students/:studentId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_STUDENTS)
  async addStudent(@Param('id') id: string, @Param('studentId') studentId: string, @Req() req) {
    
    
    
    try {
      const result = await this.schoolsService.addStudent(id, studentId, req.user._id);
      
      return result;
    } catch (error) {
      this.logger.error(`Error al añadir estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.DELETE_SCHOOL)
  async remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub || req.user._id?.toString();
    
    
    
    
    try {
      const result = await this.schoolsService.remove(id, userId);
      
      return result;
    } catch (error) {
      this.logger.error(`Error al eliminar escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/owner/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  async assignOwner(@Param('id') id: string, @Param('userId') userId: string) {
    return this.schoolsService.assignOwner(id, userId);
  }

  @Get(':id/teachers')
  @UseGuards(JwtAuthGuard)
  async getTeachersBySchool(@Param('id') id: string, @Req() req) {
    this.logger.log(`Buscando profesores para la escuela con ID: ${id}`);
    
    try {
      // Verificar formato del ID
      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        throw new BadRequestException(`ID de escuela inválido: ${id}`);
      }
      
      // Usar el nuevo método que obtiene todos los profesores asociados a la escuela
      const teachers = await this.schoolsService.findAllTeachersBySchool(id);
      return teachers;
    } catch (error) {
      this.logger.error(`Error al obtener profesores de la escuela ${id}: ${error.message}`, error.stack);
      throw error;
    }
  }
}

@Controller('users/:userId/owned-schools')
@UseGuards(JwtAuthGuard)
export class UserOwnedSchoolsController {
  constructor(private schoolsService: SchoolsService) {}

  @Get()
  async getUserOwnedSchools(@Param('userId') userId: string, @Request() req) {
    try {
      // Check if the requesting user is the same as the userId or a super_admin
      if (req.user.sub !== userId && req.user.role !== UserRole.SUPER_ADMIN) {
        throw new UnauthorizedException('No tienes permiso para ver las escuelas de este usuario');
      }
      
      return this.schoolsService.findSchoolsByOwner(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener escuelas del usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

@Controller('users/:userId/administered-schools')
@UseGuards(JwtAuthGuard)
export class UserAdministeredSchoolsController {
  constructor(private schoolsService: SchoolsService) {}

  @Get()
  async getUserAdministeredSchools(@Param('userId') userId: string, @Request() req) {
    try {
      // Check if the requesting user is the same as the userId or a super_admin
      if (req.user.sub !== userId && req.user.role !== UserRole.SUPER_ADMIN) {
        throw new UnauthorizedException('No tienes permiso para ver las escuelas de este usuario');
      }
      
      return this.schoolsService.findSchoolsByAdministrator(userId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Error al obtener escuelas administradas por el usuario',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 