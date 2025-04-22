import { Controller, Get, Post, Put, Body, Param, UseGuards, Req, Logger, Query, Delete } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@Controller('courses')
export class CoursesController {
  private readonly logger = new Logger(CoursesController.name);

  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req, @Query('schoolId') schoolId?: string) {
    const userId = req.user.sub || req.user._id?.toString();
    
    this.logger.log(`Procesando solicitud para obtener todos los cursos${schoolId ? ` de la escuela ${schoolId}` : ''}`);
    this.logger.log(`Usuario: ${userId}, Rol: ${req.user.role}`);
    
    return this.coursesService.findAll(userId, req.user.role, schoolId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub || req.user._id?.toString();
    
    this.logger.log(`Procesando solicitud para obtener curso con ID: ${id}`);
    this.logger.log(`Usuario: ${userId}, Rol: ${req.user.role}`);
    
    return this.coursesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.TEACHER, UserRole.ADMIN)
  async create(@Body() createCourseDto: CreateCourseDto, @Req() req) {
    const userId = req.user.sub || req.user._id?.toString();
    
    this.logger.log(`Procesando solicitud de creación de curso: ${JSON.stringify(createCourseDto)}`);
    this.logger.log(`Usuario: ${userId}, Rol: ${req.user.role}`);
    
    console.log('CONTROLADOR - Datos completos de la solicitud:', {
      body: createCourseDto,
      userId,
      user: {
        sub: req.user.sub,
        _id: req.user._id,
        email: req.user.email,
        role: req.user.role,
      },
      token: req.headers.authorization ? `${req.headers.authorization.substr(0, 20)}...` : 'No token'
    });
    
    try {
      // Verificar formato del ID
      if (!userId) {
        this.logger.error('ID de usuario no disponible en la solicitud');
        throw new Error('ID de usuario no disponible');
      }
      
      const result = await this.coursesService.create(createCourseDto, userId);
      
      // Acceder al ID del curso usando notación segura
      const courseId = result['_id'] ? result['_id'].toString() : 'ID desconocido';
      
      this.logger.log(`Curso creado con éxito: ${courseId}`);
      this.logger.log(`Curso creado por profesor: ${userId} para escuela: ${createCourseDto.schoolId}`);
      
      return result;
    } catch (error) {
      this.logger.error(`Error al crear curso: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateCourseDto: any, @Req() req) {
    const userId = req.user.sub || req.user._id?.toString();
    
    this.logger.log(`Procesando solicitud para actualizar curso con ID: ${id}`);
    this.logger.log(`Usuario autenticado: ${userId}, Rol: ${req.user.role}`);
    
    try {
      const result = await this.coursesService.update(id, updateCourseDto, userId);
      this.logger.log(`Curso actualizado con éxito`);
      return result;
    } catch (error) {
      this.logger.error(`Error al actualizar curso: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/students/:studentId')
  @UseGuards(JwtAuthGuard)
  async addStudent(@Param('id') id: string, @Param('studentId') studentId: string, @Req() req) {
    const userId = req.user.sub || req.user._id?.toString();
    
    this.logger.log(`Procesando solicitud para añadir estudiante ${studentId} a curso ${id}`);
    this.logger.log(`Usuario autenticado: ${userId}, Rol: ${req.user.role}`);
    
    try {
      const result = await this.coursesService.addStudent(id, studentId, userId);
      this.logger.log(`Estudiante añadido con éxito al curso`);
      return result;
    } catch (error) {
      this.logger.error(`Error al añadir estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post(':id/students/:studentId/remove')
  @UseGuards(JwtAuthGuard)
  async removeStudent(@Param('id') id: string, @Param('studentId') studentId: string, @Req() req) {
    const userId = req.user.sub || req.user._id?.toString();
    
    this.logger.log(`Procesando solicitud para eliminar estudiante ${studentId} de curso ${id}`);
    this.logger.log(`Usuario autenticado: ${userId}, Rol: ${req.user.role}`);
    
    try {
      const result = await this.coursesService.removeStudent(id, studentId, userId);
      this.logger.log(`Estudiante eliminado con éxito del curso`);
      return result;
    } catch (error) {
      this.logger.error(`Error al eliminar estudiante: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req) {
    const userId = req.user.sub || req.user._id?.toString();
    
    this.logger.log(`Procesando solicitud para eliminar curso con ID: ${id}`);
    this.logger.log(`Usuario autenticado: ${userId}, Rol: ${req.user.role}`);
    
    try {
      const result = await this.coursesService.remove(id, userId);
      this.logger.log(`Curso eliminado con éxito`);
      return result;
    } catch (error) {
      this.logger.error(`Error al eliminar curso: ${error.message}`, error.stack);
      throw error;
    }
  }
} 