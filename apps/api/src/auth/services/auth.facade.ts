import { ConflictException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { AcceptCreatorTermsDto } from '../dto/accept-creator-terms.dto';
import { GoogleLoginDto } from '../dto/google-auth.dto';
import { LoginDto } from '../dto/login.dto';
import { RegisterDto } from '../dto/register.dto';
import { UserRole } from '../schemas/user.schema';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthFacade {
  constructor(private readonly authService: AuthService) {}

  async register(registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  async login(loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  async googleLogin(googleLoginDto: GoogleLoginDto) {
    const result = await this.authService.googleLogin(googleLoginDto);

    return {
      ...result,
      message: result.isNewUser
        ? 'Account created and logged in successfully'
        : 'Logged in successfully',
    };
  }

  isAccountLinkingConflict(error: any): error is ConflictException {
    return error instanceof ConflictException;
  }

  async linkGoogleAccount(googleLoginDto: GoogleLoginDto, req: Request) {
    const userId = req.user['sub'] || req.user['_id'];
    const result = await this.authService.linkGoogleAccount(
      userId,
      googleLoginDto,
    );

    return {
      ...result,
      message: 'Google account linked successfully',
    };
  }

  async logout(req: Request) {
    const userId = (req.user as any)._id;
    const sessionId = (req.user as any).sessionId;
    await this.authService.logout(userId, sessionId);

    return { message: 'Sesion cerrada correctamente' };
  }

  async getProfile(req: Request) {
    const userId = req.user['sub'] || req.user['_id'];
    return this.authService.getProfile(userId);
  }

  async updateUserRole(userId: string, role: UserRole, req: any) {
    const adminId = req.user.sub || req.user._id?.toString();
    return this.authService.updateUserRole(userId, role, adminId);
  }

  async getCreatorTermsStatus(req: Request) {
    const userId = req.user['sub'] || req.user['_id'];
    return this.authService.getCreatorTermsStatus(userId);
  }

  async acceptCreatorTerms(req: Request, body: AcceptCreatorTermsDto) {
    const userId = req.user['sub'] || req.user['_id'];
    return this.authService.acceptCreatorTerms(userId, body.version);
  }

  async makeSuperAdmin(email: string, req: Request) {
    const adminId = req.user['sub'] || req.user['_id'];
    const adminEmail = req.user['email'];
    const result = await this.authService.makeSuperAdmin(
      email,
      String(adminId),
      adminEmail,
    );

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
  }
}
