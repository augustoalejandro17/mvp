import { Module, MiddlewareConsumer, RequestMethod, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
import { School, SchoolSchema } from './schemas/school.schema';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { PlansModule } from '../plans/plans.module';
import { PlanLimitsMiddleware } from './middleware/plan-limits.middleware';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      { name: User.name, schema: UserSchema },
    ]),
    forwardRef(() => AuthModule),
    UsersModule,
    PlansModule,
  ],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PlanLimitsMiddleware)
      .forRoutes(
        { path: 'schools/:id/students', method: RequestMethod.POST },
        { path: 'schools/:id/teachers', method: RequestMethod.POST },
        { path: 'schools/:id/administratives', method: RequestMethod.POST },
        { path: 'courses/:id/enroll', method: RequestMethod.POST },
      );
  }
}
