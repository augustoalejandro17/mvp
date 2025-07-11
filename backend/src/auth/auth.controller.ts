import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  Logger,
  Patch,
  Param,
  UseGuards,
  Req,
  Get,
  ConflictException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  Permission,
  RequirePermissions,
  PermissionsGuard,
} from './guards/permissions.guard';
import { UserRole } from './schemas/user.schema';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    try {
      const result = await this.authService.register(registerDto);

      return result;
    } catch (error) {
      this.logger.error(
        `Error durante el registro: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    try {
      const result = await this.authService.login(loginDto);

      return result;
    } catch (error) {
      this.logger.error(
        `Error durante el login: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('google/login')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    try {
      const result = await this.authService.googleLogin(googleLoginDto);

      this.logger.log(
        `Google login successful for user: ${result.user.email}, isNewUser: ${result.isNewUser}`,
      );

      return {
        ...result,
        message: result.isNewUser
          ? 'Account created and logged in successfully'
          : 'Logged in successfully',
      };
    } catch (error) {
      if (error instanceof ConflictException) {
        // Account linking required
        this.logger.warn(
          `Account linking required for: ${error.getResponse()['email']}`,
        );
        throw error;
      }

      this.logger.error(`Google login failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  @Post('google/link')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async linkGoogleAccount(
    @Body() googleLoginDto: GoogleLoginDto,
    @Req() req: Request,
  ) {
    try {
      const userId = req.user['sub'] || req.user['_id'];
      const result = await this.authService.linkGoogleAccount(
        userId,
        googleLoginDto,
      );

      this.logger.log(
        `Google account linked successfully for user: ${result.user.email}`,
      );

      return {
        ...result,
        message: 'Google account linked successfully',
      };
    } catch (error) {
      this.logger.error(
        `Google account linking failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    try {
      const userId = (req.user as any)._id;
      await this.authService.logout(userId);

      return { message: 'Sesión cerrada correctamente' };
    } catch (error) {
      this.logger.error(
        `Error durante el logout: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    try {
      const userId = req.user['sub'] || req.user['_id'];
      const userProfile = await this.authService.getProfile(userId);

      this.logger.log(
        `Profile request for user: ${userId}, role: ${userProfile.role}`,
      );

      return userProfile;
    } catch (error) {
      this.logger.error(
        `Error fetching profile: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_ADMINS)
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') role: UserRole,
    @Req() req,
  ) {
    const adminId = req.user.sub || req.user._id?.toString();

    try {
      const result = await this.authService.updateUserRole(
        userId,
        role,
        adminId,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Error al actualizar rol: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  @Get('make-super-admin/:email')
  async makeSuperAdmin(@Param('email') email: string) {
    try {
      const result = await this.authService.makeSuperAdmin(email);
      return {
        success: true,
        message: `Usuario ${email} ahora tiene rol super_admin`,
        user: {
          id: result._id,
          email: result.email,
          name: result.name,
          role: result.role,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error al promover a super_admin: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
