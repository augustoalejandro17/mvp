import { IsEnum } from 'class-validator';
import { SubmissionReviewStatus } from '../schemas/class-submission.schema';

export class UpdateClassSubmissionReviewStatusDto {
  @IsEnum(SubmissionReviewStatus, {
    message:
      'reviewStatus debe ser SUBMITTED, REVIEWED o NEEDS_RESUBMISSION',
  })
  reviewStatus: SubmissionReviewStatus;
}
