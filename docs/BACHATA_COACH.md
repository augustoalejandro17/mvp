# Bachata Coach - MVP Documentation

## Overview

The Bachata Coach is an AI-powered dance analysis feature that helps users improve their bachata technique through pose estimation and real-time feedback. The system analyzes dance videos to provide metrics on timing, weight transfer, posture, hip movement, and smoothness.

## Architecture

### High-Level Design

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │     Backend      │    │    Database     │
│   (Next.js)     │◄──►│    (NestJS)      │◄──►│   (MongoDB)     │
│                 │    │                  │    │                 │
│ • Video Upload  │    │ • Analysis API   │    │ • User Data     │
│ • Pose Extract  │    │ • Metrics Calc   │    │ • Analyses      │
│ • Beat Detect   │    │ • Feedback Gen   │    │ • Results       │
│ • UI/Timeline   │    │ • Data Storage   │    │                 │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Privacy-First Approach

- **Client-side processing**: Pose estimation happens in the browser using MediaPipe
- **Minimal data transfer**: Only pose landmarks (not video) are sent to the server
- **Optional video upload**: Users can choose to keep videos local
- **Data ownership**: Users control their analysis data

## Features

### Core Analysis Metrics

1. **Timing Analysis** (30% weight)
   - Measures synchronization with music beats
   - Detects early/late steps
   - Provides mean offset and standard deviation

2. **Weight Transfer** (25% weight)
   - Analyzes lateral pelvis movement
   - Detects clear support changes
   - Measures transfer ratio per beat

3. **Posture Analysis** (20% weight)
   - Calculates torso lean angle
   - Monitors shoulder-hip alignment
   - Flags posture warnings

4. **Hip Movement** (15% weight)
   - Measures hip isolation amplitude
   - Compares hip vs torso movement
   - Promotes characteristic bachata hip action

5. **Smoothness** (10% weight)
   - Calculates movement jerk (3rd derivative)
   - Analyzes arm and joint fluidity
   - Encourages connected movement

### User Interface

- **Practice Page**: Video upload, analysis, and results
- **Progress Page**: Historical data, trends, and statistics
- **Interactive Timeline**: Beat markers, error events, and seeking
- **Skeleton Overlay**: Real-time pose visualization
- **Session Cards**: Detailed feedback and drill recommendations

### Drill System

Personalized drill recommendations based on analysis:

- **Timing Drills**: Metronome practice, beat counting
- **Weight Transfer**: Side steps with pauses
- **Posture**: Wall touch exercises
- **Hip Movement**: Figure-eight isolation
- **Smoothness**: Floating arms technique

## Technical Implementation

### Frontend Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **MediaPipe**: Client-side pose estimation
- **Meyda**: Audio analysis for beat detection

### Backend Stack

- **NestJS**: Node.js framework with decorators
- **MongoDB**: Document database with Mongoose ODM
- **TypeScript**: Shared type definitions
- **JWT Authentication**: Secure user sessions

### Key Dependencies

```json
{
  "frontend": {
    "@mediapipe/tasks-vision": "^0.10.8",
    "meyda": "^5.5.1",
    "next": "14.0.0",
    "react": "^18.2.0"
  },
  "backend": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/mongoose": "^10.0.0",
    "mongoose": "^7.0.0",
    "class-validator": "^0.14.0"
  }
}
```

## API Endpoints

### Analysis Endpoints

```typescript
POST /api/analysis/landmarks
// Create new analysis from pose landmarks
// Body: AnalysisInput
// Response: AnalysisResponse

GET /api/analysis/:id
// Get specific analysis by ID
// Response: AnalysisResponse

GET /api/analysis
// Get user's analysis history (paginated)
// Query: page, limit
// Response: AnalysisListResponse

GET /api/analysis/stats/summary
// Get user's analysis statistics
// Response: AnalysisStatsResponse
```

### Data Models

```typescript
// Analysis input from client
interface AnalysisInput {
  source: "client-landmarks";
  fps: number;
  durationMs: number;
  bpm?: number;
  frames: Frame[];
}

// Pose frame data
interface Frame {
  t: number; // timestamp in ms
  keypoints: Keypoint[];
}

// Individual pose landmark
interface Keypoint {
  name: string; // landmark name
  x: number;    // normalized x coordinate
  y: number;    // normalized y coordinate
  v?: number;   // visibility/confidence
}
```

## Setup and Installation

### Prerequisites

- Node.js 18+
- MongoDB instance
- Modern web browser with WebGL support

### Development Setup

1. **Clone and install dependencies**:
```bash
cd /Users/augustovaca/mvp
npm install
cd frontend && npm install
cd ../backend && npm install
```

2. **Environment variables**:
```bash
# Backend (.env)
MONGODB_URI=mongodb://localhost:27017/mvp
JWT_SECRET=your-secret-key
NODE_ENV=development
PORT=3001

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

3. **Start development servers**:
```bash
# Backend
cd backend
npm run start:dev

# Frontend (separate terminal)
cd frontend
npm run dev
```

4. **Access the application**:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001/api

### Production Deployment

1. **Build applications**:
```bash
cd backend && npm run build
cd ../frontend && npm run build
```

2. **Environment setup**:
- Configure production MongoDB URI
- Set secure JWT secret
- Configure CORS origins
- Set up SSL certificates

3. **Deploy**:
- Backend: Node.js server or container
- Frontend: Static hosting or serverless
- Database: MongoDB Atlas or self-hosted

## Usage Guide

### Recording Guidelines

For best analysis results:

- **Camera position**: 2-3 meters away, chest height
- **Lighting**: Front-lit, avoid backlighting
- **Framing**: Full body visible, mid-shot
- **Duration**: 30-60 seconds recommended
- **Surface**: Non-reflective floor
- **Clothing**: Contrasting colors, fitted clothes

### Analysis Workflow

1. **Upload Video**: Select local video file
2. **Processing**: Pose extraction and beat detection
3. **Analysis**: Server computes metrics and feedback
4. **Results**: Review scores, timeline, and recommendations
5. **Practice**: Follow drill suggestions
6. **Progress**: Track improvement over time

### Interpreting Results

#### Score Ranges
- **80-100**: Excellent - Professional level
- **60-79**: Good - Intermediate level
- **40-59**: Needs work - Beginner level
- **0-39**: Poor - Requires focused practice

#### Timeline Events
- **Red markers**: Timing issues (early/late)
- **Blue markers**: Weight transfer problems
- **Purple markers**: Posture warnings
- **Cyan markers**: Low hip movement
- **Green markers**: Arm stiffness

## Limitations and Considerations

### Current Limitations

- **Single person analysis**: No partner/couple detection
- **2D pose only**: No depth/3D analysis
- **Good lighting required**: Poor lighting affects accuracy
- **Limited dance styles**: Optimized for solo bachata
- **Browser compatibility**: Requires modern WebGL support

### Privacy Considerations

- Videos processed locally when possible
- Only pose landmarks sent to server
- No video storage by default
- User controls data retention
- GDPR compliant data handling

### Performance Considerations

- Client-side processing requires decent hardware
- Video file size limits (100MB recommended)
- Network bandwidth for landmark data
- MongoDB indexing for query performance

## Future Enhancements

### Planned Features

1. **3D Pose Analysis**: Depth estimation for better accuracy
2. **Partner Dancing**: Couple/partner analysis
3. **Advanced Metrics**: Musicality, expression, style
4. **Social Features**: Sharing, challenges, leaderboards
5. **Mobile App**: Native iOS/Android applications
6. **Live Analysis**: Real-time feedback during practice

### Technical Improvements

1. **Custom Models**: Trained specifically for dance
2. **GPU Acceleration**: Server-side processing options
3. **Offline Mode**: Complete client-side analysis
4. **Advanced Audio**: Onset detection, musical structure
5. **Caching**: Improved performance and user experience

## Troubleshooting

### Common Issues

1. **Pose detection fails**:
   - Ensure good lighting and clear visibility
   - Check camera angle and distance
   - Verify browser WebGL support

2. **Beat detection inaccurate**:
   - Use clear audio track
   - Avoid background noise
   - Check video file format

3. **Analysis takes too long**:
   - Reduce video duration
   - Lower video resolution
   - Check internet connection

4. **Results seem inaccurate**:
   - Review recording guidelines
   - Check pose landmarks overlay
   - Verify dance technique

### Support

For technical issues or questions:

1. Check browser console for errors
2. Verify all dependencies are installed
3. Review environment configuration
4. Test with sample videos
5. Contact development team

## Contributing

### Development Guidelines

1. **Code Style**: Follow ESLint and Prettier configurations
2. **Testing**: Write unit tests for new features
3. **Documentation**: Update docs for API changes
4. **Type Safety**: Use TypeScript strictly
5. **Performance**: Consider client-side processing impact

### Adding New Metrics

1. Update `AnalysisEngineService` with new computation
2. Add metric to `MetricReport` interface
3. Update feedback generation logic
4. Add corresponding drill recommendations
5. Update UI components for display
6. Write comprehensive tests

---

*This documentation covers the MVP implementation of the Bachata Coach feature. For the latest updates and detailed API documentation, refer to the inline code comments and type definitions.*
