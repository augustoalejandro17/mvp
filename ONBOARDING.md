# Onboarding Flow System

A complete user onboarding system for the education platform that improves user activation and reduces friction for first-time users.

## 🎯 **Overview**

The onboarding system automatically detects first-time users and guides them through a personalized setup process based on their role (Student, Teacher, Admin, School Owner).

## 🚀 **How It Works**

### **Trigger Mechanism**
1. **Login Detection**: When a user logs in, the system checks their `hasOnboarded` flag
2. **Auto-Redirect**: First-time users are automatically redirected to `/onboarding`
3. **Resume Support**: If onboarding is incomplete, users resume from their last step

### **Flow Steps**
1. **Welcome** - Platform introduction and feature overview
2. **User Type Selection** - Choose role if not already defined
3. **Profile Completion** - Fill personal information (name, phone, bio, etc.)
4. **School Setup** - For school owners only (create institution)
5. **Quick Tour** - Role-specific feature highlights

## 📁 **System Architecture**

### **Backend Components**
```
backend/src/auth/
├── schemas/user.schema.ts          # User model with onboarding fields
├── dto/onboarding.dto.ts           # Validation classes
├── services/onboarding.service.ts  # Core onboarding logic
└── controllers/onboarding.controller.ts # API endpoints
```

### **Frontend Components**
```
frontend/
├── pages/onboarding.tsx                    # Main onboarding page
├── components/onboarding/
│   ├── OnboardingFlow.tsx                  # Flow orchestrator
│   └── steps/
│       ├── WelcomeStep.tsx
│       ├── UserTypeSelectionStep.tsx
│       ├── ProfileCompletionStep.tsx
│       ├── SchoolSetupStep.tsx
│       └── QuickTourStep.tsx
└── styles/
    ├── Onboarding.module.css
    └── OnboardingSteps.module.css
```

## 🔌 **API Endpoints**

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/onboarding/status` | Get user's onboarding status |
| `POST` | `/api/auth/onboarding/initialize` | Initialize onboarding for user |
| `PUT` | `/api/auth/onboarding/step` | Update current step |
| `POST` | `/api/auth/onboarding/step/complete` | Complete a step and move to next |
| `PUT` | `/api/auth/onboarding/profile` | Update user profile information |
| `POST` | `/api/auth/onboarding/role/select` | Select/change user role |
| `POST` | `/api/auth/onboarding/school/setup` | Create school (school owners only) |
| `POST` | `/api/auth/onboarding/analytics` | Log onboarding analytics events |
| `POST` | `/api/auth/onboarding/skip` | Skip onboarding entirely |

## 🛠 **Customization Guide**

### **Adding New Steps**

1. **Update the OnboardingStep enum:**
```typescript
// backend/src/auth/schemas/user.schema.ts
export enum OnboardingStep {
  WELCOME = 'welcome',
  USER_TYPE_SELECTION = 'user_type_selection',
  PROFILE_COMPLETION = 'profile_completion',
  SCHOOL_SETUP = 'school_setup',
  YOUR_NEW_STEP = 'your_new_step',  // Add here
  QUICK_TOUR = 'quick_tour',
  COMPLETED = 'completed'
}
```

2. **Update step flow logic:**
```typescript
// backend/src/auth/services/onboarding.service.ts
private getNextStep(currentStep: OnboardingStep, userRole: UserRole): OnboardingStep | null {
  const stepFlow = {
    [OnboardingStep.WELCOME]: OnboardingStep.USER_TYPE_SELECTION,
    [OnboardingStep.USER_TYPE_SELECTION]: OnboardingStep.PROFILE_COMPLETION,
    [OnboardingStep.PROFILE_COMPLETION]: OnboardingStep.YOUR_NEW_STEP, // Add logic
    [OnboardingStep.YOUR_NEW_STEP]: userRole === UserRole.SCHOOL_OWNER ? OnboardingStep.SCHOOL_SETUP : OnboardingStep.QUICK_TOUR,
    [OnboardingStep.SCHOOL_SETUP]: OnboardingStep.QUICK_TOUR,
    [OnboardingStep.QUICK_TOUR]: null
  };
  return stepFlow[currentStep] || null;
}
```

3. **Create the step component:**
```typescript
// frontend/components/onboarding/steps/YourNewStep.tsx
import React from 'react';
import styles from '../../../styles/OnboardingSteps.module.css';

const YourNewStep: React.FC<StepProps> = ({ user, onNext, onSkip, isUpdating }) => {
  const handleContinue = () => {
    onNext('your_new_step', { 
      // step data
    });
  };

  return (
    <div className={styles.stepContainer}>
      {/* Your step UI */}
    </div>
  );
};

export default YourNewStep;
```

4. **Add to OnboardingFlow:**
```typescript
// frontend/components/onboarding/OnboardingFlow.tsx
import YourNewStep from './steps/YourNewStep';

const renderStep = () => {
  switch (currentStep) {
    // ... other cases
    case 'your_new_step':
      return <YourNewStep {...commonProps} />;
    // ... other cases
  }
};
```

### **Role-Specific Customization**

Steps can be customized based on user roles:

```typescript
// Example: Different profile fields for different roles
if (user.role === 'student') {
  // Show date of birth field
} else if (user.role === 'teacher') {
  // Show certification fields
}
```

### **Adding Analytics Events**

Track custom events during onboarding:

```typescript
await logAnalyticsEvent('custom_event_name', currentStep, {
  customData: 'value',
  userId: user.id
});
```

## 📊 **Analytics & Monitoring**

The system tracks several key events:
- `onboarding_started` - User begins onboarding
- `step_completed` - User completes each step
- `onboarding_completed` - User finishes entire flow
- `onboarding_skipped` - User skips onboarding
- Custom events for specific interactions

### **Viewing Analytics**
Analytics are currently logged to the backend console. To integrate with analytics services:

1. **Update the analytics method in OnboardingService:**
```typescript
async logAnalyticsEvent(userId: string, analyticsDto: OnboardingAnalyticsDto) {
  // Send to Google Analytics, Mixpanel, etc.
  await this.analyticsService.track(userId, analyticsDto.event, analyticsDto.metadata);
  
  // Store in database for internal reporting
  await this.analyticsModel.create({
    userId,
    event: analyticsDto.event,
    step: analyticsDto.step,
    metadata: analyticsDto.metadata,
    timestamp: new Date()
  });
}
```

## 🔒 **Security & Permissions**

- All onboarding endpoints require JWT authentication
- Users can only modify their own onboarding data
- School creation is restricted to users with `school_owner` role
- Step data is validated using DTOs with class-validator

## 🌍 **Internationalization (i18n)**

The system is structured for easy localization:

1. **Add translation files:**
```json
// locales/en.json
{
  "onboarding": {
    "welcome": {
      "title": "Welcome!",
      "subtitle": "We're glad to have you here..."
    }
  }
}
```

2. **Use in components:**
```typescript
import { useTranslation } from 'next-i18next';

const WelcomeStep = () => {
  const { t } = useTranslation('onboarding');
  
  return (
    <h2>{t('welcome.title')}</h2>
  );
};
```

## 🧪 **Testing**

### **Backend Tests**
```bash
# Test onboarding endpoints
npm run test -- --testPathPattern=onboarding

# Test specific service methods
npm run test -- onboarding.service.spec.ts
```

### **Frontend Tests**
```bash
# Test onboarding components
npm run test -- OnboardingFlow.test.tsx

# Test step components
npm run test -- steps/
```

## 🚀 **Deployment**

No additional deployment steps required. The onboarding system:
- ✅ Uses existing MongoDB database (schema auto-updates)
- ✅ Uses existing authentication system
- ✅ Integrates with current user management
- ✅ Works with existing Docker setup

## 🔧 **Configuration**

### **Environment Variables**
No new environment variables required. Uses existing:
- `JWT_SECRET` - For user authentication
- `MONGODB_URI` - For data persistence
- `NEXT_PUBLIC_API_URL` - For frontend API calls

### **Feature Flags**
To disable onboarding temporarily:

```typescript
// backend/src/auth/auth.service.ts
async getProfile(userId: string): Promise<any> {
  const user = await this.userModel.findById(userId);
  
  return {
    // ... other fields
    hasOnboarded: true, // Force skip onboarding
    // ... rest of profile
  };
}
```

## 📈 **Performance Considerations**

- **Database**: Onboarding fields are indexed for fast lookups
- **Frontend**: Components use lazy loading and code splitting
- **API**: Minimal database queries with optimized selects
- **Caching**: Profile data can be cached on frontend

## 🐛 **Troubleshooting**

### **User Stuck in Onboarding Loop**
```bash
# Manually mark user as onboarded
db.users.updateOne(
  { email: "user@example.com" }, 
  { $set: { hasOnboarded: true } }
)
```

### **Analytics Not Working**
Check that the analytics endpoint is accessible and user has valid JWT token.

### **Step Not Progressing**
Verify that the step completion API call is successful and the step data is valid.

## 📞 **Support**

For technical issues or feature requests related to the onboarding system, check:
1. Backend logs for API errors
2. Browser console for frontend errors  
3. Database for user onboarding state
4. Network tab for failed API calls 