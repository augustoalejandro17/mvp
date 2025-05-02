import { Controller, Post, Body, HttpStatus, HttpCode, Logger, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Permission, RequirePermissions, PermissionsGuard } from './guards/permissions.guard';
import { UserRole } from './schemas/user.schema';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Procesando solicitud de registro para: ${registerDto.email}`);
    
    try {
      const result = await this.authService.register(registerDto);
      this.logger.log(`Usuario registrado exitosamente: ${result.user.id} (${result.user.email})`);
      return result;
    } catch (error) {
      this.logger.error(`Error durante el registro: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`Procesando solicitud de login para: ${loginDto.email}`);
    
    try {
      const result = await this.authService.login(loginDto);
      this.logger.log(`Login exitoso para: ${result.user.id} (${result.user.email})`);
      return result;
    } catch (error) {
      this.logger.error(`Error durante el login: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_ADMINS)
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') role: UserRole,
    @Req() req
  ) {
    this.logger.log(`Actualizando rol de usuario ${userId} a ${role}`);
    const adminId = req.user.sub || req.user._id?.toString();
    
    try {
      const result = await this.authService.updateUserRole(userId, role, adminId);
      this.logger.log(`Rol actualizado exitosamente para usuario: ${userId}`);
      return result;
    } catch (error) {
      this.logger.error(`Error al actualizar rol: ${error.message}`, error.stack);
      throw error;
    }
  }
} 