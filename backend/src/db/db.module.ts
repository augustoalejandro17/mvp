import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Analysis, AnalysisSchema } from './schemas/analysis.schema';
import { Drill, DrillSchema } from './schemas/drill.schema';
import { Attempt, AttemptSchema } from './schemas/attempt.schema';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI') || 'mongodb://localhost:27017/inti_dev',
        dbName: configService.get<string>('MONGODB_DB'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Analysis.name, schema: AnalysisSchema },
      { name: Drill.name, schema: DrillSchema },
      { name: Attempt.name, schema: AttemptSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
