import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProductEvent,
  ProductEventDocument,
} from './schemas/product-event.schema';

@Injectable()
export class ProductAnalyticsService {
  constructor(
    @InjectModel(ProductEvent.name)
    private readonly productEventModel: Model<ProductEventDocument>,
  ) {}

  async trackEvent(input: {
    event: string;
    userId?: string;
    properties?: Record<string, unknown>;
  }) {
    return this.productEventModel.create({
      event: input.event,
      userId: input.userId,
      properties: input.properties || {},
    });
  }

  async getFunnel(days: number = 30) {
    const safeDays = Math.min(365, Math.max(1, days));
    const since = new Date(Date.now() - safeDays * 24 * 60 * 60 * 1000);

    const [logins, onboardingStarted, onboardingCompleted] = await Promise.all([
      this.productEventModel.distinct('userId', {
        event: 'auth_login_success',
        createdAt: { $gte: since },
        userId: { $ne: null },
      }),
      this.productEventModel.distinct('userId', {
        event: 'onboarding_started',
        createdAt: { $gte: since },
        userId: { $ne: null },
      }),
      this.productEventModel.distinct('userId', {
        event: 'onboarding_completed',
        createdAt: { $gte: since },
        userId: { $ne: null },
      }),
    ]);

    const loginCount = logins.length;
    const onboardingStartedCount = onboardingStarted.length;
    const onboardingCompletedCount = onboardingCompleted.length;

    const startRate =
      loginCount > 0
        ? Number(((onboardingStartedCount / loginCount) * 100).toFixed(2))
        : 0;
    const completionRate =
      onboardingStartedCount > 0
        ? Number(
            ((onboardingCompletedCount / onboardingStartedCount) * 100).toFixed(
              2,
            ),
          )
        : 0;

    return {
      periodDays: safeDays,
      since: since.toISOString(),
      steps: {
        authLoginSuccess: loginCount,
        onboardingStarted: onboardingStartedCount,
        onboardingCompleted: onboardingCompletedCount,
      },
      conversion: {
        loginToOnboardingStartPct: startRate,
        onboardingStartToCompletedPct: completionRate,
      },
    };
  }
}
