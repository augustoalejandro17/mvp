import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';

@Schema({ _id: false })
export class Weights {
  @Prop({ required: true, default: 0.4 })
  timing: number;

  @Prop({ required: true, default: 0.3 })
  hips: number;

  @Prop({ required: true, default: 0.2 })
  posture: number;

  @Prop({ required: true, default: 0.1 })
  arms: number;
}

const WeightsSchema = SchemaFactory.createForClass(Weights);

@Schema({ _id: false })
export class DrillPhase {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  beatFrom: number;

  @Prop({ required: true })
  beatTo: number;
}

export const DrillPhaseSchema = SchemaFactory.createForClass(DrillPhase);

@Schema({ timestamps: { createdAt: true, updatedAt: false }, collection: 'drills' })
export class Drill {
  _id: any;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', index: true, required: true })
  teacherId: any;

  @Prop({ required: true })
  title: string;

  @Prop()
  bpm?: number;

  @Prop({ type: WeightsSchema, default: { timing: 0.4, hips: 0.3, posture: 0.2, arms: 0.1 } })
  weights: Weights;

  @Prop({ type: [String], default: [] })
  hints: string[];

  // { featureNames: string[], perBeat: number[][] }
  @Prop({ type: SchemaTypes.Mixed, required: true })
  refFeatures: any;

  @Prop({ type: [DrillPhaseSchema], default: [] })
  phases: DrillPhase[];

  createdAt: Date;
}

export type DrillDocument = HydratedDocument<Drill>;
export const DrillSchema = SchemaFactory.createForClass(Drill);

// Add compound index for efficient queries
DrillSchema.index({ teacherId: 1, createdAt: -1 });
