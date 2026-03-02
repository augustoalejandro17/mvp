import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ProductEventDocument = ProductEvent & Document;

@Schema({ timestamps: true })
export class ProductEvent {
  @Prop({ required: true, index: true })
  event: string;

  @Prop({ required: false, index: true })
  userId?: string;

  @Prop({ type: Object, default: {} })
  properties: Record<string, unknown>;
}

export const ProductEventSchema = SchemaFactory.createForClass(ProductEvent);
