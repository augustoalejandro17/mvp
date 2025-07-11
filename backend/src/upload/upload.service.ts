import { Injectable, BadRequestException } from '@nestjs/common';
import { SubscriptionsService } from '../plans/subscriptions.service';

@Injectable()
export class UploadService {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  async validateStorageLimit(
    schoolId: string,
    fileSizeInBytes: number,
  ): Promise<boolean> {
    const fileSizeInGb = fileSizeInBytes / (1024 * 1024 * 1024);

    const result = await this.subscriptionsService.hasAvailableStorage(
      schoolId,
      fileSizeInGb,
    );

    if (!result.hasSpace) {
      throw new BadRequestException(result.message);
    }

    return true;
  }

  async uploadFile(file: Express.Multer.File, schoolId: string): Promise<any> {
    await this.validateStorageLimit(schoolId, file.size);

    await this.subscriptionsService.updateStorageUsage(
      schoolId,
      file.size / (1024 * 1024 * 1024),
    );

    return;
  }
}
