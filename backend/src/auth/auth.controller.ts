import { Controller, Post, Body, HttpStatus, HttpCode, Logger } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Procesando solicitud de registro para: ${registerDto.email}, rol: ${registerDto.role}`);
    
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
} 