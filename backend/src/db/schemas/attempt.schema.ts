import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'attempts' })
export class Attempt {
  _id: any;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Drill', index: true, required: true })
  drillId: any;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', index: true, required: true })
  studentId: any;

  @Prop({ required: true })
  fps: number;

  @Prop({ required: true })
  durationMs: number;

  @Prop()
  bpm?: number;

  @Prop({ type: SchemaTypes.Mixed })
  landmarks?: unknown;

  // { global, timing, hips, posture, arms, perPhase:[{phaseId?, name?, score}] }
  @Prop({ type: SchemaTypes.Mixed, required: true })
  scores: any;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  timeline: any[];

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  feedback: any[];

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  drills: any[];

  createdAt: Date;
}

export type AttemptDocument = HydratedDocument<Attempt>;
export const AttemptSchema = SchemaFactory.createForClass(Attempt);

// Add compound indexes for efficient queries
AttemptSchema.index({ drillId: 1, studentId: 1, createdAt: -1 });
AttemptSchema.index({ studentId: 1, createdAt: -1 });
