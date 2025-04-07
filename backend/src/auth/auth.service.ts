import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as argon2 from 'argon2';
import { User, UserRole } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    this.logger.log(`Procesando registro de usuario: ${registerDto.email}, rol: ${registerDto.role}`);
    
    try {
      // Verificar si el usuario ya existe
      const existingUser = await this.userModel.findOne({ email: registerDto.email });
      if (existingUser) {
        this.logger.warn(`Intento de registro con email existente: ${registerDto.email}`);
        throw new UnauthorizedException('El email ya está registrado');
      }
      
      // Usar argon2 para hacer hash de la contraseña
      const hashedPassword = await argon2.hash(registerDto.password, {
        type: argon2.argon2id, // Variante más segura
        memoryCost: 2**16,     // Coste de memoria
        timeCost: 3,           // Iteraciones
        parallelism: 1         // Paralelismo
      });
      
      const user = await this.userModel.create({
        ...registerDto,
        password: hashedPassword,
      });

      this.logger.log(`Usuario registrado exitosamente: ${user._id} (${user.email})`);

      const payload = { 
        sub: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      
      const token = this.jwtService.sign(payload);
      
      this.logger.log(`Token JWT generado para el usuario: ${user._id}`);
      this.logger.debug(`Payload del token: ${JSON.stringify(payload)}`);

      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      };
    } catch (error) {
      this.logger.error(`Error durante el registro: ${error.message}`, error.stack);
      throw error;
    }
  }

  async login(loginDto: LoginDto) {
    this.logger.log(`Intento de login para usuario: ${loginDto.email}`);
    
    try {
      const user = await this.userModel.findOne({ email: loginDto.email });
      
      if (!user) {
        this.logger.warn(`Intento de login con email no registrado: ${loginDto.email}`);
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Verificar la contraseña con argon2
      const isPasswordValid = await argon2.verify(user.password, loginDto.password);
      
      if (!isPasswordValid) {
        this.logger.warn(`Contraseña incorrecta para el usuario: ${loginDto.email}`);
        throw new UnauthorizedException('Credenciales inválidas');
      }

      this.logger.log(`Login exitoso para el usuario: ${user._id} (${user.email})`);

      const payload = { 
        sub: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      
      const token = this.jwtService.sign(payload);
      
      this.logger.log(`Token JWT generado para el usuario: ${user._id}`);
      this.logger.debug(`Payload del token: ${JSON.stringify(payload)}`);

      return {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        token,
      };
    } catch (error) {
      this.logger.error(`Error durante el login: ${error.message}`, error.stack);
      throw error;
    }
  }
} 