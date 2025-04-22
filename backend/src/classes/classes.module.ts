import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';
import { Class, ClassSchema } from './schemas/class.schema';
import { AuthModule } from '../auth/auth.module';
import { CoursesModule } from '../courses/courses.module';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { S3Service } from '../services/s3.service';
import { ConfigModule } from '@nestjs/config';
import awsConfig from '../config/aws.config';
import { CloudFrontService } from '../services/cloudfront.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Class.name, schema: ClassSchema },
      { name: User.name, schema: UserSchema }
    ]),
    AuthModule,
    CoursesModule,
    UsersModule,
    ConfigModule.forFeature(awsConfig),
  ],
  controllers: [ClassesController],
  providers: [
    ClassesService, 
    S3Service, 
    CloudFrontService
  ],
  exports: [ClassesService],
})
export class ClassesModule {} 