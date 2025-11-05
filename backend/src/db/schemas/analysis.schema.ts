import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'analyses' })
export class Analysis {
  _id: any;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', index: true, required: true })
  userId: any;

  @Prop({ required: true })
  source: string; // "client-landmarks" | "video+server"

  @Prop({ required: true })
  fps: number;

  @Prop({ required: true })
  durationMs: number;

  @Prop()
  bpm?: number;

  @Prop({ type: SchemaTypes.Mixed })
  landmarks?: unknown; // optional compact

  @Prop({ type: SchemaTypes.Mixed, required: true })
  metrics: any;

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  feedback: any[];

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  timeline: any[];

  @Prop({ type: [SchemaTypes.Mixed], default: [] })
  drills: any[];

  @Prop({ required: true })
  overallScore: number;

  createdAt: Date;
}

export type AnalysisDocument = HydratedDocument<Analysis>;
export const AnalysisSchema = SchemaFactory.createForClass(Analysis);

// Add compound index for efficient queries
AnalysisSchema.index({ userId: 1, createdAt: -1 });
