import { Module, Logger, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthFacade } from './services/auth.facade';
import { AuthorizationService } from './services/authorization.service';
import { OnboardingService } from './services/onboarding.service';
import { OnboardingFacade } from './services/onboarding.facade';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OnboardingController } from './controllers/onboarding.controller';
import { User, UserSchema } from './schemas/user.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';
import { GamificationModule } from '../gamification/gamification.module';
import { AuditModule } from '../audit/audit.module';
import { ProductAnalyticsModule } from '../product-analytics/product-analytics.module';

const logger = new Logger('AuthModule');

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        const expiresIn = configService.get<string>('JWT_EXPIRATION') || '8h';

        if (!secret) {
          logger.error(
            'JWT_SECRET no está definido en las variables de entorno',
          );
          throw new Error('JWT_SECRET no está definido');
        }

        logger.log(`JWT configurado con expiración: ${expiresIn}`);

        return {
          secret,
          signOptions: { expiresIn },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
    forwardRef(() => GamificationModule),
    AuditModule,
    ProductAnalyticsModule,
  ],
  controllers: [AuthController, OnboardingController],
  providers: [
    AuthService,
    AuthFacade,
    JwtStrategy,
    AuthorizationService,
    OnboardingService,
    OnboardingFacade,
    GoogleOAuthService,
  ],
  exports: [
    AuthService,
    AuthFacade,
    AuthorizationService,
    OnboardingService,
    OnboardingFacade,
    GoogleOAuthService,
  ],
})
export class AuthModule {}
