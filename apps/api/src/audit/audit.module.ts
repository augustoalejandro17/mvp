import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditController } from './audit.controller';
import { AuditFacade } from './services/audit.facade';
import { AuditService } from './audit.service';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: AuditLog.name, schema: AuditLogSchema }]),
  ],
  controllers: [AuditController],
  providers: [AuditService, AuditFacade],
  exports: [AuditService, AuditFacade],
})
export class AuditModule {}
