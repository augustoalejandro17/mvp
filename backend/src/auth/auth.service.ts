import { Injectable, UnauthorizedException, Logger, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import * as argon2 from 'argon2';
import { User, UserRole } from './schemas/user.schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

// Definir tipo UserDocument
export type UserDocument = User & Document;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private jwtService: JwtService,
  ) {}

  // Método auxiliar para hacer hash de contraseñas
  private async hashPassword(password: string): Promise<string> {
    return await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2**16,
      timeCost: 3,
      parallelism: 1
    });
  }

  // Método auxiliar para generar token JWT
  private async generateToken(user: UserDocument): Promise<string> {
    const payload = { 
      sub: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
    
    return this.jwtService.sign(payload);
  }

  async register(registerDto: RegisterDto): Promise<{ user: any; token: string }> {
    
    
    try {
      // Verificar si el usuario ya existe
      const existingUser = await this.userModel.findOne({ email: registerDto.email });
      if (existingUser) {
        
        throw new UnauthorizedException('El email ya está registrado');
      }
      
      // Usar argon2 para hacer hash de la contraseña
      const hashedPassword = await this.hashPassword(registerDto.password);
      
      // Asignar siempre el rol de estudiante
      const user = await this.userModel.create({
        ...registerDto,
        role: UserRole.STUDENT, // Forzar el rol de estudiante
        password: hashedPassword,
      });

      

      const token = await this.generateToken(user);
      
      

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
    const { email, password } = loginDto;
    
    try {
      const user = await this.userModel.findOne({ email });
      
      if (!user) {
        
        throw new UnauthorizedException('Credenciales inválidas');
      }
      
      // Usar argon2 para verificar la contraseña, ya que el registro usa argon2
      const isPasswordValid = await argon2.verify(user.password, password);
      
      if (!isPasswordValid) {
        
        throw new UnauthorizedException('Credenciales inválidas');
      }
      
      const token = await this.generateToken(user);
      
      
      
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
      this.logger.error(`Error al intentar login para email ${email}: ${error.message}`, error.stack);
      
      // No exponer errores internos, solo rethrow si es un error de autenticación
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Error al procesar la autenticación');
    }
  }

  async updateUserRole(userId: string, newRole: UserRole, adminId: string): Promise<UserDocument> {
    try {
      // Verificar que el usuario existe
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('Usuario no encontrado');
      }

      // Verificar que el administrador no está intentando cambiar su propio rol
      if (userId === adminId) {
        throw new BadRequestException('No puede cambiar su propio rol');
      }

      // Actualizar el rol del usuario
      user.role = newRole;
      await user.save();

      

      return user;
    } catch (error) {
      this.logger.error(`Error al actualizar rol de usuario: ${error.message}`, error.stack);
      throw error;
    }
  }

  async makeSuperAdmin(email: string): Promise<UserDocument> {
    try {
      // Buscar el usuario por email
      const user = await this.userModel.findOne({ email });
      if (!user) {
        throw new NotFoundException(`Usuario con email ${email} no encontrado`);
      }

      // Actualizar el rol a SUPER_ADMIN
      user.role = UserRole.SUPER_ADMIN;
      await user.save();

      

      return user;
    } catch (error) {
      this.logger.error(`Error al promover a SUPER_ADMIN: ${error.message}`, error.stack);
      throw error;
    }
  }
} 