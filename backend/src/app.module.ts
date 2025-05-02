import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SchoolsModule } from './schools/schools.module';
import { CoursesModule } from './courses/courses.module';
import { ClassesModule } from './classes/classes.module';
import { ServicesModule } from './services/services.module';
import { UploadModule } from './upload/upload.module';
import awsConfig from './config/aws.config';
import { S3Service } from './services/s3.service';
import { CloudFrontService } from './services/cloudfront.service';
import { ImagesController } from './controllers/images.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [awsConfig],
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || 'mongodb://localhost:27017/mvp'),
    AuthModule,
    UsersModule,
    SchoolsModule,
    CoursesModule,
    ClassesModule,
    ServicesModule,
    UploadModule,
  ],
  controllers: [AppController, ImagesController],
  providers: [AppService, S3Service, CloudFrontService],
})
export class AppModule {} 