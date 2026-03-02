import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model } from 'mongoose';
import { OAuth2Client } from 'google-auth-library';
import {
  User,
  UserDocument,
  UserRole,
  AuthProvider,
} from '../schemas/user.schema';
import { GoogleLoginDto, LinkGoogleAccountDto } from '../dto/google-auth.dto';
import { School } from '../../schools/schemas/school.schema';

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified: boolean;
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);
  private googleClient: OAuth2Client;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      this.logger.warn(
        'GOOGLE_CLIENT_ID not configured - Google OAuth will not work',
      );
    }
    this.googleClient = new OAuth2Client(clientId);
  }

  async verifyGoogleToken(idToken: string): Promise<GoogleUserInfo> {
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      if (!payload.email_verified) {
        throw new UnauthorizedException('Google email not verified');
      }

      return {
        sub: payload.sub,
        email: payload.email,
        name:
          payload.name ||
          `${payload.given_name || ''} ${payload.family_name || ''}`.trim(),
        given_name: payload.given_name,
        family_name: payload.family_name,
        picture: payload.picture,
        email_verified: payload.email_verified,
      };
    } catch (error) {
      this.logger.error(`Google token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  async googleLogin(
    googleLoginDto: GoogleLoginDto,
  ): Promise<{ user: any; isNewUser: boolean }> {
    const googleUser = await this.verifyGoogleToken(googleLoginDto.idToken);

    // Check if user exists by Google ID first
    let user = await this.userModel.findOne({ googleId: googleUser.sub });

    if (user) {
      // User exists with Google ID - normal login
      this.logger.log(`Google login for existing user: ${googleUser.email}`);
      return { user, isNewUser: false };
    }

    // Check if user exists by email
    user = await this.userModel.findOne({ email: googleUser.email });

    if (user) {
      // User exists with same email but different provider
      if (user.provider === AuthProvider.LOCAL && !user.googleId) {
        // Local user wants to login with Google - need to link accounts
        throw new ConflictException({
          code: 'ACCOUNT_LINKING_REQUIRED',
          message:
            'An account with this email already exists. Please link your Google account.',
          email: googleUser.email,
          existingProvider: user.provider,
        });
      } else {
        // Update Google ID if missing
        user.googleId = googleUser.sub;
        user.provider = AuthProvider.GOOGLE;
        await user.save();
        return { user, isNewUser: false };
      }
    }

    // Create new user
    user = await this.createGoogleUser(googleUser);
    this.logger.log(`Created new Google user: ${googleUser.email}`);
    return { user, isNewUser: true };
  }

  async linkGoogleAccount(
    userId: string,
    linkDto: LinkGoogleAccountDto,
  ): Promise<any> {
    const googleUser = await this.verifyGoogleToken(linkDto.idToken);

    // Get the user who wants to link their account
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Check if email matches
    if (user.email !== googleUser.email) {
      throw new BadRequestException(
        'Google account email does not match your account email',
      );
    }

    // Check if this Google account is already linked to another user
    const existingGoogleUser = await this.userModel.findOne({
      googleId: googleUser.sub,
      _id: { $ne: userId },
    });

    if (existingGoogleUser) {
      throw new ConflictException(
        'This Google account is already linked to another user',
      );
    }

    // Link the account
    user.googleId = googleUser.sub;
    user.provider = AuthProvider.GOOGLE;
    if (googleUser.picture && !user.profileImageUrl) {
      user.profileImageUrl = googleUser.picture;
    }

    await user.save();
    this.logger.log(`Linked Google account for user: ${user.email}`);
    return user;
  }

  private async createGoogleUser(googleUser: GoogleUserInfo): Promise<any> {
    const userData = {
      email: googleUser.email,
      name: googleUser.name,
      firstName: googleUser.given_name || '',
      lastName: googleUser.family_name || '',
      provider: AuthProvider.GOOGLE,
      googleId: googleUser.sub,
      providerId: googleUser.sub,
      role: UserRole.STUDENT, // Default role for new users
      profileImageUrl: googleUser.picture,
      isActive: true,
      createdAt: new Date(),
    };

    return await this.userModel.create(userData);
  }

  async unlinkGoogleAccount(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.provider === AuthProvider.GOOGLE && !user.password) {
      throw new BadRequestException(
        'Cannot unlink Google account without setting a password first',
      );
    }

    user.googleId = undefined;
    user.providerId = undefined;
    if (user.provider === AuthProvider.GOOGLE) {
      user.provider = AuthProvider.LOCAL;
    }

    await user.save();
    this.logger.log(`Unlinked Google account for user: ${user.email}`);
    return user;
  }
}
