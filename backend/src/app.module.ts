import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { SchoolsModule } from './schools/schools.module';
import { CoursesModule } from './courses/courses.module';
import { S3Service } from './services/s3.service';
import { CloudFrontService } from './services/cloudfront.service';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI),
    AuthModule,
    UsersModule,
    ClassesModule,
    SchoolsModule,
    CoursesModule,
  ],
  controllers: [AppController],
  providers: [
    S3Service,
    CloudFrontService,
  ],
})
export class AppModule {} 