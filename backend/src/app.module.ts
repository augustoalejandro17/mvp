import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ClassesModule } from './classes/classes.module';
import { SchoolsModule } from './schools/schools.module';
import { CoursesModule } from './courses/courses.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    MongooseModule.forRoot('mongodb://mongo:27017/dance-platform'),
    AuthModule,
    UsersModule,
    ClassesModule,
    SchoolsModule,
    CoursesModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {} 