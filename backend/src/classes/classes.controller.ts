import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Logger, Query } from '@nestjs/common';
import { ClassesService } from './classes.service';
import { CreateClassDto } from './dto/create-class.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/schemas/user.schema';

@Controller('classes')
export class ClassesController {
  private readonly logger = new Logger(ClassesController.name);

  constructor(private readonly classesService: ClassesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(@Req() req, @Query('courseId') courseId?: string) {
    this.logger.log(`Procesando solicitud para obtener todas las clases${courseId ? ` del curso ${courseId}` : ''}`);
    return this.classesService.findAll(req.user._id, req.user.role, courseId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    this.logger.log(`Procesando solicitud para obtener clase con ID: ${id}`);
    return this.classesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() createClassDto: CreateClassDto, @Req() req) {
    this.logger.log(`Creando clase: ${JSON.stringify(createClassDto)}`);
    const result = await this.classesService.create(createClassDto, req.user.sub);
    this.logger.log(`Clase creada con éxito`);
    return result;
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@Param('id') id: string, @Body() updateClassDto: any, @Req() req) {
    this.logger.log(`Procesando solicitud para actualizar clase con ID: ${id}`);
    this.logger.log(`Usuario autenticado: ${req.user._id}`);
    
    try {
      const result = await this.classesService.update(id, updateClassDto, req.user._id);
      this.logger.log(`Clase actualizada con éxito: ${result._id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al actualizar clase: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(@Param('id') id: string, @Req() req) {
    this.logger.log(`Procesando solicitud para eliminar clase con ID: ${id}`);
    this.logger.log(`Usuario autenticado: ${req.user._id}`);
    
    try {
      const result = await this.classesService.remove(id, req.user._id);
      this.logger.log(`Clase eliminada con éxito`);
      return result;
    } catch (error) {
      this.logger.error(`Error al eliminar clase: ${error.message}`, error.stack);
      throw error;
    }
  }
} 