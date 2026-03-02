import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BillingEventDocument = BillingEvent & Document;

@Schema({ timestamps: true })
export class BillingEvent {
  @Prop({ required: true })
  provider: string;

  @Prop({ required: true })
  eventId: string;

  @Prop({ required: true })
  eventType: string;

  @Prop({ default: false })
  processed: boolean;

  @Prop({ type: Date, required: false })
  processedAt?: Date;

  @Prop({ type: String, required: false })
  errorMessage?: string;

  @Prop({ type: Object, required: false })
  payload?: Record<string, unknown>;
}

export const BillingEventSchema = SchemaFactory.createForClass(BillingEvent);
BillingEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
