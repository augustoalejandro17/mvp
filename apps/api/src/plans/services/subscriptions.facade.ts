import { Injectable } from '@nestjs/common';
import { CreateSubscriptionDto } from '../dto/create-subscription.dto';
import { UpdateSubscriptionDto } from '../dto/update-subscription.dto';
import { SubscriptionsService } from '../subscriptions.service';

@Injectable()
export class SubscriptionsFacade {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  create(createSubscriptionDto: CreateSubscriptionDto) {
    return this.subscriptionsService.create(createSubscriptionDto);
  }

  findAll() {
    return this.subscriptionsService.findAll();
  }

  findOne(id: string) {
    return this.subscriptionsService.findOne(id);
  }

  findBySchool(id: string) {
    return this.subscriptionsService.findBySchool(id);
  }

  update(id: string, updateSubscriptionDto: UpdateSubscriptionDto) {
    return this.subscriptionsService.update(id, updateSubscriptionDto);
  }

  remove(id: string) {
    return this.subscriptionsService.remove(id);
  }

  validateUserLimit(schoolId: string) {
    return this.subscriptionsService.canAddUserToSchool(schoolId);
  }

  validateEnrollment(userId: string, courseId: string) {
    return this.subscriptionsService.canEnrollUserToCourse(userId, courseId);
  }

  validateStorage(schoolId: string, requiredGb: number) {
    return this.subscriptionsService.hasAvailableStorage(schoolId, requiredGb);
  }
}
