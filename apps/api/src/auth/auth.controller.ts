import {
  Controller,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  Patch,
  Param,
  UseGuards,
  Req,
  Get,
} from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GoogleLoginDto } from './dto/google-auth.dto';
import { AcceptCreatorTermsDto } from './dto/accept-creator-terms.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import {
  Permission,
  RequirePermissions,
  PermissionsGuard,
} from './guards/permissions.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from './schemas/user.schema';
import { Request } from 'express';
import { AuthFacade } from './services/auth.facade';

@Controller('auth')
export class AuthController {
  constructor(private readonly authFacade: AuthFacade) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() registerDto: RegisterDto) {
    return this.authFacade.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authFacade.login(loginDto);
  }

  @Post('google/login')
  @HttpCode(HttpStatus.OK)
  async googleLogin(@Body() googleLoginDto: GoogleLoginDto) {
    return this.authFacade.googleLogin(googleLoginDto);
  }

  @Post('google/link')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async linkGoogleAccount(
    @Body() googleLoginDto: GoogleLoginDto,
    @Req() req: Request,
  ) {
    return this.authFacade.linkGoogleAccount(googleLoginDto, req);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request) {
    return this.authFacade.logout(req);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request) {
    return this.authFacade.getProfile(req);
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(Permission.MANAGE_ADMINS)
  async updateUserRole(
    @Param('id') userId: string,
    @Body('role') role: UserRole,
    @Req() req,
  ) {
    return this.authFacade.updateUserRole(userId, role, req);
  }

  @Get('creator-terms/status')
  @UseGuards(JwtAuthGuard)
  async getCreatorTermsStatus(@Req() req: Request) {
    return this.authFacade.getCreatorTermsStatus(req);
  }

  @Patch('creator-terms/accept')
  @UseGuards(JwtAuthGuard)
  async acceptCreatorTerms(
    @Req() req: Request,
    @Body() body: AcceptCreatorTermsDto,
  ) {
    return this.authFacade.acceptCreatorTerms(req, body);
  }

  @Get('make-super-admin/:email')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async makeSuperAdmin(@Param('email') email: string, @Req() req: Request) {
    return this.authFacade.makeSuperAdmin(email, req);
  }
}
