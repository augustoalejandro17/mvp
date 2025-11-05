import { IsNumber, IsString, IsOptional, IsArray, ValidateNested, Min, Max, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { FrameDto } from '../../analysis/dto/analysis.dto';

export class DrillWeightsDto {
  @IsNumber()
  @Min(0)
  @Max(1)
  timing: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  hips: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  posture: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  arms: number;
}

export class CreateDrillDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(200)
  bpm?: number;

  @IsNumber()
  @Min(1)
  @Max(60)
  fps: number;

  @IsNumber()
  @Min(1000)
  @Max(120000)
  durationMs: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameDto)
  frames: FrameDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hints?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => DrillWeightsDto)
  weights?: DrillWeightsDto;
}

export class DrillPhaseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  beatFrom: number;

  @IsNumber()
  @Min(0)
  beatTo: number;
}

export class UpdateDrillDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(200)
  bpm?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => DrillWeightsDto)
  weights?: DrillWeightsDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hints?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DrillPhaseDto)
  phases?: DrillPhaseDto[];
}

export class AttemptInputDto {
  @IsNumber()
  @Min(1)
  @Max(60)
  fps: number;

  @IsNumber()
  @Min(1000)
  @Max(120000)
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

export class DrillResponseDto {
  id: string;
  title: string;
  bpm?: number;
  weights: DrillWeightsDto;
  hints: string[];
  phases: DrillPhaseDto[];
  reference: {
    featureNames: string[];
    perBeat: number[][];
  };
  createdAt: Date;
}

export class DrillListResponseDto {
  id: string;
  title: string;
  bpm?: number;
  createdAt: Date;
  phases: DrillPhaseDto[];
}

export class AttemptResponseDto {
  attemptId: string;
  scores: {
    global: number;
    timing: number;
    hips: number;
    posture: number;
    arms: number;
    perPhase: { phaseId: string; score: number }[];
  };
  timeline: Array<{
    t: number;
    type: string;
    beat?: number;
    value?: number;
    note?: string;
  }>;
  feedback: string[];
  drills: Array<{
    title: string;
    durationSec: number;
    how: string;
  }>;
}

export class AttemptListResponseDto {
  id: string;
  drillId: string;
  drillTitle: string;
  createdAt: Date;
  scores: {
    global: number;
    timing: number;
    hips: number;
    posture: number;
    arms: number;
    perPhase: { phaseId: string; score: number }[];
  };
}
