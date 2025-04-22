import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, Logger, Delete } from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@Controller('schools')
export class SchoolsController {
  private readonly logger = new Logger(SchoolsController.name);

  constructor(private readonly schoolsService: SchoolsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req) {
    this.logger.log('Procesando solicitud para obtener todas las escuelas');
    return this.schoolsService.findAll(req.user._id, req.user.role);
  }

  @Get('teacher/:id')
  @UseGuards(JwtAuthGuard)
  async findByTeacher(@Param('id') id: string, @Req() req) {
    this.logger.log(`Buscando escuelas para profesor: ${id}`);
    const schools = await this.schoolsService.findAll(id, UserRole.TEACHER);
    this.logger.log(`Se encontraron ${schools.length} escuelas para el profesor ${id}`);
    return schools;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    this.logger.log(`Procesando solicitud para obtener escuela con ID: ${id}`);
    return this.schoolsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.TEACHER)
  async create(@Body() createSchoolDto: CreateSchoolDto, @Req() req) {
    this.logger.log(`Procesando solicitud para crear escuela: ${JSON.stringify(createSchoolDto)}`);
    this.logger.log(`Usuario autenticado: ${req.user._id}, rol: ${req.user.role}`);
    
    try {
      const result = await this.schoolsService.create(createSchoolDto, req.user._id);
      this.logger.log(`Escuela creada con éxito: ${result._id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al crear escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateSchoolDto: any, @Req() req) {
    this.logger.log(`Procesando solicitud para actualizar escuela con ID: ${id}`);
    this.logger.log(`Usuario autenticado: ${req.user._id}`);
    
    try {
      const result = await this.schoolsService.update(id, updateSchoolDto, req.user._id);
      this.logger.log(`Escuela actualizada con éxito: ${result._id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al actualizar escuela: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/teachers/:teacherId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async addTeacher(@Param('id') id: string, @Param('teacherId') teacherId: string, @Req() req) {
    this.logger.log(`Procesando solicitud para añadir profesor ${teacherId} a escuela ${id}`);
    this.logger.log(`Usuario autenticado: ${req.user._id}`);
    
    try {
      const result = await this.schoolsService.addTeacher(id, teacherId, req.user._id);
      this.logger.log(`Profesor añadido con éxito a la escuela`);
      return result;
    } catch (error) {
      this.logger.error(`Error al añadir profesor: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/students/:studentId')
  @UseGuards(JwtAuthGuard)
  async addStudent(@Param('id') id: string, @Param('studentId') studentId: string, @Req() req) {
    this.logger.log(`Procesando solicitud para añadir estudiante ${studentId} a escuela ${id}`);
    this.logger.log(`Usuario autenticado: ${req.user._id}`);
    
    try {
      const result = await this.schoolsService.addStudent(id, studentId, req.user._id);
      this.logger.log(`Estudiante añadido con éxito a la escuela`);
      return result;
    } catch (error) {
      this.logger.error(`Error al añadir estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub || req.user._id?.toString();
    
    this.logger.log(`Procesando solicitud para eliminar escuela con ID: ${id}`);
    this.logger.log(`Usuario autenticado: ${userId}`);
    
    try {
      const result = await this.schoolsService.remove(id, userId);
      this.logger.log(`Escuela eliminada con éxito`);
      return result;
    } catch (error) {
      this.logger.error(`Error al eliminar escuela: ${error.message}`, error.stack);
      throw error;
    }
  }
} 