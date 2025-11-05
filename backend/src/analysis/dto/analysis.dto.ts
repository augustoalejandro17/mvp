import { IsNumber, IsString, IsOptional, IsArray, ValidateNested, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class KeypointDto {
  @IsString()
  name: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsOptional()
  @IsNumber()
  v?: number;
}

export class FrameDto {
  @IsNumber()
  @Min(0)
  t: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KeypointDto)
  keypoints: KeypointDto[];
}

export class CreateAnalysisDto {
  @IsString()
  @IsEnum(['client-landmarks'])
  source: 'client-landmarks';

  @IsNumber()
  @Min(1)
  @Max(60)
  fps: number;

  @IsNumber()
  @Min(1000)
  @Max(120000) // max 2 minutes
  durationMs: number;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(200)
  bpm?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameDto)
  frames: FrameDto[];
}

export class AnalysisResponseDto {
  analysisId: string;
  result: {
    metrics: {
      timing_ms: { mean: number; std: number };
      weight_transfer_ratio: number;
      posture_deg: number;
      hip_amplitude_deg: number;
      smoothness: number;
    };
    feedback: string[];
    drills: Array<{
      title: string;
      durationSec: number;
      how: string;
    }>;
    timeline: Array<{
      t: number;
      type: string;
      value?: number;
      note?: string;
    }>;
  };
}

export class AnalysisListResponseDto {
  id: string;
  createdAt: Date;
  durationMs: number;
  bpm?: number;
  metrics: {
    timing_ms: { mean: number; std: number };
    weight_transfer_ratio: number;
    posture_deg: number;
    hip_amplitude_deg: number;
    smoothness: number;
  };
  overallScore: number;
}
