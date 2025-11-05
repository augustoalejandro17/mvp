import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Drill, DrillDocument } from '../db/schemas/drill.schema';
import { Attempt, AttemptDocument } from '../db/schemas/attempt.schema';
import { CreateDrillDto, UpdateDrillDto, AttemptInputDto, DrillResponseDto, DrillListResponseDto, AttemptResponseDto, AttemptListResponseDto } from './dto/coach.dto';
import { FeatureExtractorService } from './services/feature-extractor.service';
import { DTWService } from './services/dtw.service';
import { CoachEngineService } from './services/coach-engine.service';

@Injectable()
export class CoachService {
  constructor(
    @InjectModel(Drill.name) private drillModel: Model<DrillDocument>,
    @InjectModel(Attempt.name) private attemptModel: Model<AttemptDocument>,
    private featureExtractor: FeatureExtractorService,
    private dtwService: DTWService,
    private coachEngine: CoachEngineService,
  ) {}

  async createDrill(teacherId: string, createDrillDto: CreateDrillDto): Promise<DrillResponseDto> {
    const { title, bpm: inputBpm, fps, durationMs, frames, hints = [], weights } = createDrillDto;

    // Estimate BPM if not provided (reuse existing logic)
    let bpm = inputBpm;
    if (!bpm) {
      // For now, use a default BPM - in a full implementation, you'd extract from audio
      bpm = 120; // Default bachata BPM
    }

    // Extract per-beat features from reference frames
    const refFeatures = this.featureExtractor.extractPerBeatFeatures(frames, bpm, true);

    // Create default phases if none provided
    const totalBeats = refFeatures.perBeat.length;
    const defaultPhases = [
      {
        id: uuidv4(),
        name: 'Intro',
        beatFrom: 0,
        beatTo: Math.min(3, totalBeats - 1),
      },
      {
        id: uuidv4(),
        name: 'Basic',
        beatFrom: 4,
        beatTo: Math.min(totalBeats - 1, 11),
      },
    ].filter(phase => phase.beatFrom <= phase.beatTo && phase.beatTo < totalBeats);

    // Set default weights if not provided
    const drillWeights = weights || {
      timing: 0.4,
      hips: 0.3,
      posture: 0.2,
      arms: 0.1,
    };

    // Create and save drill using Mongoose
    const savedDrill = await this.drillModel.create({
      teacherId: new Types.ObjectId(teacherId),
      title,
      bpm,
      weights: drillWeights,
      hints,
      refFeatures,
      phases: defaultPhases,
    });

    return this.mapDrillToResponse(savedDrill);
  }

  async updateDrill(teacherId: string, drillId: string, updateDrillDto: UpdateDrillDto): Promise<DrillResponseDto> {
    const drill = await this.drillModel.findById(new Types.ObjectId(drillId));

    if (!drill) {
      throw new NotFoundException('Drill not found');
    }

    if (drill.teacherId.toString() !== teacherId) {
      throw new ForbiddenException('You can only update your own drills');
    }

    // Prepare update object
    const updateObj: any = {};
    if (updateDrillDto.title) updateObj.title = updateDrillDto.title;
    if (updateDrillDto.bpm) updateObj.bpm = updateDrillDto.bpm;
    if (updateDrillDto.weights) updateObj.weights = updateDrillDto.weights;
    if (updateDrillDto.hints) updateObj.hints = updateDrillDto.hints;
    if (updateDrillDto.phases) updateObj.phases = updateDrillDto.phases;

    const updatedDrill = await this.drillModel.findByIdAndUpdate(
      new Types.ObjectId(drillId),
      { $set: updateObj },
      { new: true, lean: true }
    );

    return this.mapDrillToResponse(updatedDrill);
  }

  async getTeacherDrills(teacherId: string, page: number = 1, limit: number = 10): Promise<{
    drills: DrillListResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const teacherObjectId = new Types.ObjectId(teacherId);

    const [drills, total] = await Promise.all([
      this.drillModel
        .find({ teacherId: teacherObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('title bpm createdAt phases')
        .lean()
        .exec(),
      this.drillModel.countDocuments({ teacherId: teacherObjectId }),
    ]);

    const drillListItems: DrillListResponseDto[] = drills.map(drill => ({
      id: drill._id.toString(),
      title: drill.title,
      bpm: drill.bpm,
      createdAt: drill.createdAt,
      phases: drill.phases,
    }));

    return {
      drills: drillListItems,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDrill(drillId: string): Promise<DrillResponseDto> {
    const drill = await this.drillModel.findById(new Types.ObjectId(drillId)).lean();

    if (!drill) {
      throw new NotFoundException('Drill not found');
    }

    return this.mapDrillToResponse(drill);
  }

  async createAttempt(
    studentId: string,
    drillId: string,
    attemptInput: AttemptInputDto
  ): Promise<AttemptResponseDto> {
    // Get the drill
    const drill = await this.drillModel.findById(new Types.ObjectId(drillId)).lean();
    if (!drill) {
      throw new NotFoundException('Drill not found');
    }

    const { fps, durationMs, bpm: inputBpm, frames } = attemptInput;

    // Use drill BPM if not provided in attempt
    const bpm = inputBpm || drill.bpm || 120;

    // Extract per-beat features from student frames
    const stuFeatures = this.featureExtractor.extractPerBeatFeatures(frames, bpm, false);

    // Create feature weights from drill weights
    const featureWeights = [
      drill.weights.timing,    // timing_offset_ms
      drill.weights.posture,   // torso_deg
      drill.weights.hips,      // hip_amp_deg
      0.1,                     // weight_transfer (small constant weight)
      drill.weights.arms,      // arms_smoothness
    ];

    // Perform DTW alignment
    const dtwResult = this.dtwService.multivariateDTW(
      drill.refFeatures.perBeat,
      stuFeatures.perBeat,
      featureWeights,
      0.1 // 10% band
    );

    // Compute scores
    const scores = this.coachEngine.computeScores(
      drill.refFeatures.perBeat,
      stuFeatures.perBeat,
      dtwResult.path,
      drill.weights,
      drill.phases
    );

    // Build timeline
    const timeline = this.coachEngine.buildTimeline(
      drill.refFeatures.perBeat,
      stuFeatures.perBeat,
      dtwResult.path,
      bpm
    );

    // Generate feedback and drills
    const { feedback, drills } = this.coachEngine.ruleEngine(scores, timeline, drill.hints);

    // Create and save attempt using Mongoose
    const savedAttempt = await this.attemptModel.create({
      drillId: new Types.ObjectId(drillId),
      studentId: new Types.ObjectId(studentId),
      fps,
      durationMs,
      bpm,
      landmarks: frames, // Optional: store for audit
      scores,
      timeline,
      feedback,
      drills,
    });

    return {
      attemptId: savedAttempt._id.toString(),
      scores,
      timeline,
      feedback,
      drills,
    };
  }

  async getDrillAttempts(
    drillId: string,
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<{
    attempts: AttemptListResponseDto[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    // Verify drill exists and user has access
    const drill = await this.drillModel.findById(new Types.ObjectId(drillId)).lean();
    if (!drill) {
      throw new NotFoundException('Drill not found');
    }

    const drillObjectId = new Types.ObjectId(drillId);
    const userObjectId = new Types.ObjectId(userId);

    // Teachers can see all attempts, students can only see their own
    const query = drill.teacherId.toString() === userId 
      ? { drillId: drillObjectId }
      : { drillId: drillObjectId, studentId: userObjectId };

    const skip = (page - 1) * limit;

    const [attempts, total] = await Promise.all([
      this.attemptModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.attemptModel.countDocuments(query),
    ]);

    const attemptListItems: AttemptListResponseDto[] = attempts.map(attempt => ({
      id: attempt._id.toString(),
      drillId: attempt.drillId.toString(),
      drillTitle: drill.title, // Use the drill title we already fetched
      createdAt: attempt.createdAt,
      scores: attempt.scores,
    }));

    return {
      attempts: attemptListItems,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAttempt(attemptId: string, userId: string): Promise<AttemptResponseDto> {
    const attempt = await this.attemptModel.findById(new Types.ObjectId(attemptId)).lean();

    if (!attempt) {
      throw new NotFoundException('Attempt not found');
    }

    // Get the drill to check access permissions
    const drill = await this.drillModel.findById(attempt.drillId).lean();
    if (!drill) {
      throw new NotFoundException('Associated drill not found');
    }

    // Check access: student can see their own attempts, teacher can see attempts on their drills
    if (attempt.studentId.toString() !== userId && drill.teacherId.toString() !== userId) {
      throw new ForbiddenException('You do not have access to this attempt');
    }

    return {
      attemptId: attempt._id.toString(),
      scores: attempt.scores,
      timeline: attempt.timeline,
      feedback: attempt.feedback,
      drills: attempt.drills,
    };
  }

  private mapDrillToResponse(drill: any): DrillResponseDto {
    return {
      id: drill._id.toString(),
      title: drill.title,
      bpm: drill.bpm,
      weights: drill.weights,
      hints: drill.hints,
      phases: drill.phases,
      reference: drill.refFeatures,
      createdAt: drill.createdAt,
    };
  }
}
