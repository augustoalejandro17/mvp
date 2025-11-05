# Bachata Coach MVP - Setup Instructions

## 🎯 Overview

A functional Bachata coach/assistant MVP has been successfully integrated into your existing Next.js + NestJS monorepo. The system performs client-side pose estimation and sends only landmarks to the backend for privacy-optimized analysis.

## 📁 Files Created

### Backend (NestJS)
```
backend/src/analysis/
├── schemas/analysis.schema.ts          # MongoDB schema for analysis data
├── dto/analysis.dto.ts                 # Data transfer objects and validation
├── services/analysis-engine.service.ts # Core analysis algorithms
├── analysis.service.ts                 # Business logic and database operations
├── analysis.controller.ts              # REST API endpoints
├── analysis.module.ts                  # NestJS module configuration
├── analysis.controller.spec.ts         # Controller tests
└── services/analysis-engine.service.spec.ts # Engine tests
```

### Frontend (Next.js)
```
frontend/
├── types/bachata-analysis.ts           # Shared TypeScript types
├── hooks/
│   ├── usePoseExtractor.ts            # MediaPipe pose extraction hook
│   └── useSessionUser.ts              # Mock authentication hook
├── utils/
│   ├── analysis-api.ts                # API client for analysis endpoints
│   └── beatDetector.ts                # Client-side beat detection
├── components/
│   ├── OverlayCanvas.tsx              # Skeleton overlay visualization
│   ├── Timeline.tsx                   # Interactive timeline with events
│   ├── SessionCard.tsx                # Analysis results and drills
│   └── __tests__/SessionCard.test.tsx # Component tests
└── pages/
    ├── practice.tsx                   # Main analysis page
    └── progress.tsx                   # User progress tracking
```

### Documentation
```
docs/BACHATA_COACH.md                  # Comprehensive documentation
BACHATA_COACH_SETUP.md                 # This setup file
```

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd /Users/augustovaca/mvp/frontend
npm install  # Already done - MediaPipe and Meyda installed

cd ../backend
# No new dependencies needed - using existing MongoDB setup
```

### 2. Update App Module
The analysis module has already been added to `backend/src/app.module.ts`:
```typescript
import { AnalysisModule } from './analysis/analysis.module';
// ... added to imports array
```

### 3. Start Development Servers
```bash
# Backend (Terminal 1)
cd backend
npm run start:dev

# Frontend (Terminal 2) 
cd frontend
npm run dev
```

### 4. Access the Features
- **Practice Page**: http://localhost:3000/practice
- **Progress Page**: http://localhost:3000/progress
- **API Endpoints**: http://localhost:3001/api/analysis/*

## 🎬 Usage Flow

1. **Navigate to `/practice`**
2. **Upload a dance video** (30-60s, MP4/MOV recommended)
3. **Wait for processing** (pose extraction + beat detection)
4. **Review results** with interactive timeline and skeleton overlay
5. **Follow drill recommendations** with built-in timers
6. **Track progress** on `/progress` page

## 📊 Analysis Metrics

The system computes 5 key metrics:

| Metric | Weight | Description |
|--------|--------|-------------|
| **Timing** | 30% | Synchronization with music beats |
| **Weight Transfer** | 25% | Clear weight shifts between feet |
| **Posture** | 20% | Torso alignment and lean |
| **Hip Movement** | 15% | Hip isolation amplitude |
| **Smoothness** | 10% | Movement fluidity (jerk analysis) |

## 🔧 Configuration

### Environment Variables
```bash
# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/mvp  # Your existing MongoDB
JWT_SECRET=your-existing-secret            # Your existing JWT secret
NODE_ENV=development
PORT=3001

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### Recording Guidelines
For optimal analysis results:
- **Distance**: 2-3 meters from camera
- **Lighting**: Good front lighting, avoid backlighting  
- **Framing**: Full body visible in frame
- **Duration**: 30-60 seconds recommended
- **Clothing**: Fitted clothes, contrasting colors

## 🧪 Testing

### Run Backend Tests
```bash
cd backend
npm test analysis  # Run analysis module tests
```

### Run Frontend Tests
```bash
cd frontend
npm test -- --testPathPattern=SessionCard  # Run component tests
```

## 🔒 Privacy Features

- ✅ **Client-side processing**: Pose extraction in browser
- ✅ **Minimal data transfer**: Only landmarks sent to server
- ✅ **No video storage**: Videos stay on user's device by default
- ✅ **User control**: Optional video upload feature
- ✅ **Data ownership**: Users can delete their analysis data

## 📈 API Endpoints

All endpoints require authentication (JWT token):

```typescript
POST /api/analysis/landmarks     // Create analysis from pose data
GET  /api/analysis/:id          // Get specific analysis
GET  /api/analysis              // Get user's analyses (paginated)
GET  /api/analysis/stats/summary // Get user statistics
```

## 🎯 Key Features Implemented

### ✅ Core MVP Features
- [x] Video upload and pose extraction (MediaPipe)
- [x] Beat detection (Meyda) 
- [x] 5 dance metrics computation
- [x] Rule-based feedback generation
- [x] Personalized drill recommendations
- [x] Interactive timeline with error markers
- [x] Skeleton overlay visualization
- [x] Progress tracking and statistics
- [x] Session history and trends

### ✅ Technical Features
- [x] MongoDB integration with existing schema
- [x] TypeScript strict typing throughout
- [x] Comprehensive error handling
- [x] Unit and integration tests
- [x] Responsive UI design
- [x] Client-side privacy optimization

## 🔍 Troubleshooting

### Common Issues

1. **MediaPipe loading fails**
   - Check browser WebGL support
   - Ensure HTTPS in production
   - Verify network connectivity

2. **Pose detection inaccurate**
   - Improve lighting conditions
   - Check camera angle and distance
   - Ensure full body is visible

3. **Beat detection fails**
   - Use videos with clear audio
   - Avoid background music/noise
   - Check audio format compatibility

4. **Analysis takes too long**
   - Reduce video file size
   - Lower video resolution
   - Check device performance

## 🚧 Future Enhancements

The MVP is designed for easy extension:

- **3D pose analysis**: Upgrade to depth-aware models
- **Partner dancing**: Multi-person detection
- **Advanced metrics**: Musicality, expression analysis
- **Mobile app**: React Native implementation
- **Real-time analysis**: Live camera feed processing
- **Social features**: Sharing, challenges, leaderboards

## 🏗️ Architecture Notes

### Data Flow
```
Video Upload → MediaPipe (Client) → Pose Landmarks → 
Backend Analysis → Metrics + Feedback → 
UI Visualization + Drills
```

### Technology Stack
- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, MediaPipe
- **Backend**: NestJS, MongoDB/Mongoose, TypeScript
- **Testing**: Jest, React Testing Library
- **Authentication**: JWT (using existing system)

## 📝 Development Notes

1. **Mock Authentication**: `useSessionUser` hook provides development user
2. **Error Handling**: Comprehensive error boundaries and user feedback
3. **Performance**: Client-side processing minimizes server load
4. **Scalability**: MongoDB indexes and pagination for large datasets
5. **Maintainability**: Clean architecture with separation of concerns

---

The Bachata Coach MVP is now fully integrated and ready for testing! 🎉

Navigate to http://localhost:3000/practice to start analyzing dance videos.
