# @inti/shared-types

Shared TypeScript types and interfaces for the Inti education platform.

## Overview

This package contains all shared type definitions used across the Inti monorepo:
- Backend API (`apps/api`)
- Web Admin (`apps/web-admin`)
- Mobile App (`apps/mobile-app`)

## Usage

```typescript
import { IUser, UserRole, ICourse, VideoStatus } from '@inti/shared-types';

const user: IUser = {
  email: 'user@example.com',
  name: 'John Doe',
  role: UserRole.STUDENT,
  // ... other properties
};
```

## Development

Build the package:
```bash
npm run build
```

Watch for changes:
```bash
npm run watch
```

## Structure

- `user.types.ts` - User, roles, and authentication provider types
- `course.types.ts` - Course-related types
- `class.types.ts` - Video lesson/class types
- `school.types.ts` - School and institution types
- `enrollment.types.ts` - Student enrollment types
- `category.types.ts` - Category and classification types
- `plan.types.ts` - Subscription plans and pricing types
- `auth.types.ts` - Authentication and authorization DTOs
- `index.ts` - Main export file

## Notes

- All interfaces starting with `I` represent database entities
- DTOs (Data Transfer Objects) are for API requests/responses
- Enums are used for status fields and role definitions

