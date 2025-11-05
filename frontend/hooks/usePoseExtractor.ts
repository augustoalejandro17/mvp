import { useState, useRef, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { Frame, Keypoint, POSE_LANDMARKS } from '../types/bachata-analysis';

interface UsePoseExtractorReturn {
  isLoading: boolean;
  error: string | null;
  extractPoseFromVideo: (videoFile: File) => Promise<Frame[]>;
  isProcessing: boolean;
  progress: number;
}

export const usePoseExtractor = (): UsePoseExtractorReturn => {
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);

  const initializePoseLandmarker = useCallback(async () => {
    if (poseLandmarkerRef.current) return poseLandmarkerRef.current;

    try {
      setIsLoading(true);
      setError(null);

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
      );

      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      poseLandmarkerRef.current = poseLandmarker;
      return poseLandmarker;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize pose detector';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const extractPoseFromVideo = useCallback(async (videoFile: File): Promise<Frame[]> => {
    try {
      setIsProcessing(true);
      setProgress(0);
      setError(null);

      // Initialize pose landmarker
      const poseLandmarker = await initializePoseLandmarker();

      // Create video element
      const video = document.createElement('video');
      video.src = URL.createObjectURL(videoFile);
      video.muted = true;
      
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error('Failed to load video'));
        video.load();
      });

      const frames: Frame[] = [];
      const targetFPS = 15; // Sample at 15 FPS for analysis
      const frameInterval = 1 / targetFPS;
      const videoDuration = video.duration;
      const totalFrames = Math.floor(videoDuration * targetFPS);

      let frameIndex = 0;
      
      for (let time = 0; time < videoDuration; time += frameInterval) {
        video.currentTime = time;
        
        await new Promise<void>((resolve) => {
          video.onseeked = () => resolve();
        });

        try {
          const results = poseLandmarker.detectForVideo(video, time * 1000);
          
          if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            const keypoints: Keypoint[] = landmarks.map((landmark, index) => ({
              name: getLandmarkName(index),
              x: landmark.x,
              y: landmark.y,
              v: landmark.visibility || 1,
            }));

            frames.push({
              t: time * 1000, // Convert to milliseconds
              keypoints,
            });
          }
        } catch (err) {
          console.warn(`Failed to process frame at ${time}s:`, err);
        }

        frameIndex++;
        setProgress((frameIndex / totalFrames) * 100);
      }

      // Clean up
      URL.revokeObjectURL(video.src);

      if (frames.length === 0) {
        throw new Error('No pose detected in video. Make sure you are clearly visible in the frame.');
      }

      return frames;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to extract pose from video';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, [initializePoseLandmarker]);

  return {
    isLoading,
    error,
    extractPoseFromVideo,
    isProcessing,
    progress,
  };
};

// Map MediaPipe landmark indices to our landmark names
function getLandmarkName(index: number): string {
  const landmarkMap: Record<number, string> = {
    0: POSE_LANDMARKS.NOSE,
    1: POSE_LANDMARKS.LEFT_EYE_INNER,
    2: POSE_LANDMARKS.LEFT_EYE,
    3: POSE_LANDMARKS.LEFT_EYE_OUTER,
    4: POSE_LANDMARKS.RIGHT_EYE_INNER,
    5: POSE_LANDMARKS.RIGHT_EYE,
    6: POSE_LANDMARKS.RIGHT_EYE_OUTER,
    7: POSE_LANDMARKS.LEFT_EAR,
    8: POSE_LANDMARKS.RIGHT_EAR,
    9: POSE_LANDMARKS.MOUTH_LEFT,
    10: POSE_LANDMARKS.MOUTH_RIGHT,
    11: POSE_LANDMARKS.LEFT_SHOULDER,
    12: POSE_LANDMARKS.RIGHT_SHOULDER,
    13: POSE_LANDMARKS.LEFT_ELBOW,
    14: POSE_LANDMARKS.RIGHT_ELBOW,
    15: POSE_LANDMARKS.LEFT_WRIST,
    16: POSE_LANDMARKS.RIGHT_WRIST,
    17: POSE_LANDMARKS.LEFT_PINKY,
    18: POSE_LANDMARKS.RIGHT_PINKY,
    19: POSE_LANDMARKS.LEFT_INDEX,
    20: POSE_LANDMARKS.RIGHT_INDEX,
    21: POSE_LANDMARKS.LEFT_THUMB,
    22: POSE_LANDMARKS.RIGHT_THUMB,
    23: POSE_LANDMARKS.LEFT_HIP,
    24: POSE_LANDMARKS.RIGHT_HIP,
    25: POSE_LANDMARKS.LEFT_KNEE,
    26: POSE_LANDMARKS.RIGHT_KNEE,
    27: POSE_LANDMARKS.LEFT_ANKLE,
    28: POSE_LANDMARKS.RIGHT_ANKLE,
    29: POSE_LANDMARKS.LEFT_HEEL,
    30: POSE_LANDMARKS.RIGHT_HEEL,
    31: POSE_LANDMARKS.LEFT_FOOT_INDEX,
    32: POSE_LANDMARKS.RIGHT_FOOT_INDEX,
  };

  return landmarkMap[index] || `landmark_${index}`;
}
