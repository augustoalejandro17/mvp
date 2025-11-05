import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Analysis, AnalysisDocument } from '../db/schemas/analysis.schema';
import { CreateAnalysisDto, AnalysisResponseDto, AnalysisListResponseDto } from './dto/analysis.dto';
import { AnalysisEngineService } from './services/analysis-engine.service';

@Injectable()
export class AnalysisService {
  constructor(
    @InjectModel(Analysis.name) private analysisModel: Model<AnalysisDocument>,
    private analysisEngine: AnalysisEngineService,
  ) {}

  async createAnalysis(userId: string, createAnalysisDto: CreateAnalysisDto): Promise<AnalysisResponseDto> {
    const { frames, fps, durationMs, bpm, source } = createAnalysisDto;

    // Compute metrics using the analysis engine
    const timingResult = this.analysisEngine.computeTiming(frames, bpm);
    const weightTransferResult = this.analysisEngine.computeWeightTransfer(frames);
    const postureResult = this.analysisEngine.computePosture(frames);
    const hipAmplitudeResult = this.analysisEngine.computeHipAmplitude(frames);
    const smoothnessResult = this.analysisEngine.computeSmoothness(frames);

    // Combine metrics
    const metrics = {
      timing_ms: { mean: timingResult.mean, std: timingResult.std },
      weight_transfer_ratio: weightTransferResult.ratio,
      posture_deg: postureResult.posture_deg,
      hip_amplitude_deg: hipAmplitudeResult.hip_amplitude_deg,
      smoothness: smoothnessResult.smoothness,
    };

    // Generate feedback and drills
    const { feedback, drills } = this.analysisEngine.buildFeedback(metrics);

    // Combine timeline events
    const timeline = [
      ...timingResult.events,
      ...weightTransferResult.events,
      ...postureResult.events,
      ...hipAmplitudeResult.events,
      ...smoothnessResult.events,
    ].sort((a, b) => a.t - b.t);

    // Calculate overall score
    const overallScore = this.analysisEngine.computeOverallScore(metrics);

    // Create and save analysis using Mongoose
    const analysisDoc = await this.analysisModel.create({
      userId: new Types.ObjectId(userId),
      source,
      fps,
      durationMs,
      bpm,
      landmarks: frames, // Store for potential recomputation
      metrics,
      feedback,
      drills,
      timeline,
      overallScore,
    });

    return {
      analysisId: analysisDoc._id.toString(),
      result: {
        metrics,
        feedback,
        drills,
        timeline,
      },
    };
  }

  async getAnalysis(userId: string, analysisId: string): Promise<AnalysisResponseDto | null> {
    const analysis = await this.analysisModel
      .findOne({ _id: new Types.ObjectId(analysisId), userId: new Types.ObjectId(userId) })
      .lean()
      .exec();

    if (!analysis) {
      return null;
    }

    return {
      analysisId: analysis._id.toString(),
      result: {
        metrics: analysis.metrics,
        feedback: analysis.feedback,
        drills: analysis.drills,
        timeline: analysis.timeline,
      },
    };
  }

  async getUserAnalyses(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{ analyses: AnalysisListResponseDto[]; total: number; page: number; totalPages: number }> {
    const skip = (page - 1) * limit;
    const userObjectId = new Types.ObjectId(userId);

    const [analyses, total] = await Promise.all([
      this.analysisModel
        .find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('createdAt durationMs bpm metrics overallScore')
        .lean()
        .exec(),
      this.analysisModel.countDocuments({ userId: userObjectId }),
    ]);

    const analysisListItems: AnalysisListResponseDto[] = analyses.map(analysis => ({
      id: analysis._id.toString(),
      createdAt: analysis.createdAt,
      durationMs: analysis.durationMs,
      bpm: analysis.bpm,
      metrics: analysis.metrics,
      overallScore: analysis.overallScore,
    }));

    return {
      analyses: analysisListItems,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAnalysisStats(userId: string): Promise<{
    totalAnalyses: number;
    averageScore: number;
    bestScore: number;
    recentTrend: 'improving' | 'declining' | 'stable';
  }> {
    const analyses = await this.analysisModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .select('overallScore createdAt')
      .lean()
      .exec();

    if (analyses.length === 0) {
      return {
        totalAnalyses: 0,
        averageScore: 0,
        bestScore: 0,
        recentTrend: 'stable',
      };
    }

    const totalAnalyses = analyses.length;
    const averageScore = analyses.reduce((sum, a) => sum + a.overallScore, 0) / totalAnalyses;
    const bestScore = Math.max(...analyses.map(a => a.overallScore));

    // Determine trend by comparing recent vs older scores
    let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (analyses.length >= 4) {
      const recent = analyses.slice(0, 2).reduce((sum, a) => sum + a.overallScore, 0) / 2;
      const older = analyses.slice(-2).reduce((sum, a) => sum + a.overallScore, 0) / 2;
      
      if (recent > older + 5) {
        recentTrend = 'improving';
      } else if (recent < older - 5) {
        recentTrend = 'declining';
      }
    }

    return {
      totalAnalyses,
      averageScore: Math.round(averageScore),
      bestScore,
      recentTrend,
    };
  }
}
