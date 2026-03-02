import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true, index: true })
  actorId: string;

  @Prop({ required: false })
  actorEmail?: string;

  @Prop({ required: true, index: true })
  targetType: string;

  @Prop({ required: false, index: true })
  targetId?: string;

  @Prop({ type: Object, default: {} })
  metadata: Record<string, unknown>;

  @Prop({ required: false })
  ipAddress?: string;

  @Prop({ required: false })
  userAgent?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
