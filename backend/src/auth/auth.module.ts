import { Module, Logger } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthorizationService } from './services/authorization.service';
import { OnboardingService } from './services/onboarding.service';
import { OnboardingController } from './controllers/onboarding.controller';
import { User, UserSchema } from './schemas/user.schema';
import { JwtStrategy } from './strategies/jwt.strategy';
import { School, SchoolSchema } from '../schools/schemas/school.schema';
import { Course, CourseSchema } from '../courses/schemas/course.schema';

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
          logger.error('JWT_SECRET no está definido en las variables de entorno');
          throw new Error('JWT_SECRET no está definido');
        }
        
        logger.log(`JWT configurado con expiración: ${expiresIn}`);
        
        return {
          secret,
          signOptions: { expiresIn },
        };
      }
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: School.name, schema: SchoolSchema },
      { name: Course.name, schema: CourseSchema },
    ]),
  ],
  controllers: [AuthController, OnboardingController],
  providers: [AuthService, JwtStrategy, AuthorizationService, OnboardingService],
  exports: [AuthService, AuthorizationService, OnboardingService],
})
export class AuthModule {} 