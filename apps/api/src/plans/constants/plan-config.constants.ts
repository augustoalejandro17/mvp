/**
 * Authoritative Pricing Configuration
 * All prices in cents (integer) to avoid float math
 * Matches the exact pricing table from requirements
 */

export enum PlanType {
  BASIC = 'basic',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  PREMIUM = 'premium',
}

export interface PlanConfig {
  readonly type: PlanType;
  readonly name: string;
  readonly monthlyPriceCents: number; // Price in cents
  readonly studentSeats: number; // Any user attached to academy
  readonly teachers: number;
  readonly maxConcurrentCoursesPerStudent: number;
  readonly storageGB: number;
  readonly streamingHoursPerMonth: number;
  readonly overUsageUnitPrices: {
    readonly studentCents: number; // Per additional student
    readonly storageCentsPerGB: number; // Per additional GB
    readonly streamingCentsPerHour: number; // Per additional hour
  };
  readonly features: readonly string[];
}

export const PLAN_CONFIGS: Record<PlanType, PlanConfig> = {
  [PlanType.BASIC]: {
    type: PlanType.BASIC,
    name: 'Basic',
    monthlyPriceCents: 10000, // $100.00
    studentSeats: 20,
    teachers: 2,
    maxConcurrentCoursesPerStudent: 1,
    storageGB: 20,
    streamingHoursPerMonth: 20,
    overUsageUnitPrices: {
      studentCents: 300, // $3.00 per student
      storageCentsPerGB: 20, // $0.20 per GB
      streamingCentsPerHour: 6, // $0.06 per hour
    },
    features: [
      'Basic platform access',
      'Standard support',
      'Basic analytics',
      'Mobile app access',
    ] as const,
  },

  [PlanType.INTERMEDIATE]: {
    type: PlanType.INTERMEDIATE,
    name: 'Intermediate',
    monthlyPriceCents: 30000, // $300.00
    studentSeats: 60,
    teachers: 5,
    maxConcurrentCoursesPerStudent: 2,
    storageGB: 60,
    streamingHoursPerMonth: 60,
    overUsageUnitPrices: {
      studentCents: 250, // $2.50 per student
      storageCentsPerGB: 20, // $0.20 per GB (same as Basic)
      streamingCentsPerHour: 6, // $0.06 per hour (same as Basic)
    },
    features: [
      'Enhanced platform features',
      'Priority support',
      'Advanced analytics',
      'Custom branding',
      'API access',
      'Bulk user management',
    ] as const,
  },

  [PlanType.ADVANCED]: {
    type: PlanType.ADVANCED,
    name: 'Advanced',
    monthlyPriceCents: 60000, // $600.00
    studentSeats: 120,
    teachers: 10,
    maxConcurrentCoursesPerStudent: 3,
    storageGB: 120,
    streamingHoursPerMonth: 120,
    overUsageUnitPrices: {
      studentCents: 200, // $2.00 per student
      storageCentsPerGB: 20, // $0.20 per GB (same)
      streamingCentsPerHour: 6, // $0.06 per hour (same)
    },
    features: [
      'Full platform capabilities',
      'Premium support',
      'Real-time analytics',
      'White-label solution',
      'Advanced API access',
      'Multi-location support',
      'Custom integrations',
      'Advanced reporting',
    ] as const,
  },

  [PlanType.PREMIUM]: {
    type: PlanType.PREMIUM,
    name: 'Premium',
    monthlyPriceCents: 100000, // $1000.00
    studentSeats: 500,
    teachers: 15,
    maxConcurrentCoursesPerStudent: 4,
    storageGB: 250,
    streamingHoursPerMonth: 250,
    overUsageUnitPrices: {
      studentCents: 150, // $1.50 per student (in blocks of 50, avg $1-1.5)
      storageCentsPerGB: 20, // $0.20 per GB (same)
      streamingCentsPerHour: 6, // $0.06 per hour (same)
    },
    features: [
      'Enterprise-grade platform',
      'Dedicated support',
      'Real-time analytics',
      'Full white-label',
      'Enterprise API',
      'Unlimited locations',
      'Custom development',
      'Dedicated account manager',
      'SLA guarantee',
      'Priority feature requests',
    ] as const,
  },
} as const;

// Helper functions
export const getPlanConfig = (planType: PlanType): PlanConfig => {
  return PLAN_CONFIGS[planType];
};

export const getAllPlanConfigs = (): PlanConfig[] => {
  return Object.values(PLAN_CONFIGS);
};

export const formatPriceFromCents = (cents: number): string => {
  return `$${(cents / 100).toFixed(2)}`;
};

export const convertDollarsToCents = (dollars: number): number => {
  return Math.round(dollars * 100);
};

// Validation helpers
export const isValidPlanType = (type: string): type is PlanType => {
  return Object.values(PlanType).includes(type as PlanType);
};

export const calculateOveragePrice = (
  planType: PlanType,
  resourceType: 'student' | 'storage' | 'streaming',
  overageAmount: number,
): number => {
  const config = getPlanConfig(planType);

  switch (resourceType) {
    case 'student':
      return config.overUsageUnitPrices.studentCents * overageAmount;
    case 'storage':
      return config.overUsageUnitPrices.storageCentsPerGB * overageAmount;
    case 'streaming':
      return config.overUsageUnitPrices.streamingCentsPerHour * overageAmount;
    default:
      throw new Error(`Invalid resource type: ${resourceType}`);
  }
};
