import React, { useRef, useEffect } from 'react';
import { Frame, Keypoint, POSE_LANDMARKS } from '../types/bachata-analysis';

interface OverlayCanvasProps {
  frame: Frame | null;
  videoElement: HTMLVideoElement | null;
  width: number;
  height: number;
  className?: string;
}

const SKELETON_CONNECTIONS = [
  // Head
  [POSE_LANDMARKS.NOSE, POSE_LANDMARKS.LEFT_EYE],
  [POSE_LANDMARKS.NOSE, POSE_LANDMARKS.RIGHT_EYE],
  [POSE_LANDMARKS.LEFT_EYE, POSE_LANDMARKS.LEFT_EAR],
  [POSE_LANDMARKS.RIGHT_EYE, POSE_LANDMARKS.RIGHT_EAR],
  
  // Torso
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],
  
  // Arms
  [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
  [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],
  [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
  [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],
  
  // Legs
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
  [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
  [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
  
  // Feet
  [POSE_LANDMARKS.LEFT_ANKLE, POSE_LANDMARKS.LEFT_FOOT_INDEX],
  [POSE_LANDMARKS.RIGHT_ANKLE, POSE_LANDMARKS.RIGHT_FOOT_INDEX],
];

export const OverlayCanvas: React.FC<OverlayCanvasProps> = ({
  frame,
  videoElement,
  width,
  height,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !frame) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw skeleton
    drawSkeleton(ctx, frame.keypoints, width, height);
  }, [frame, width, height]);

  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    keypoints: Keypoint[],
    canvasWidth: number,
    canvasHeight: number
  ) => {
    const keypointMap = new Map<string, Keypoint>();
    keypoints.forEach(kp => keypointMap.set(kp.name, kp));

    // Draw connections
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (const [startName, endName] of SKELETON_CONNECTIONS) {
      const startPoint = keypointMap.get(startName);
      const endPoint = keypointMap.get(endName);

      if (startPoint && endPoint && 
          (startPoint.v || 0) > 0.5 && (endPoint.v || 0) > 0.5) {
        const startX = startPoint.x * canvasWidth;
        const startY = startPoint.y * canvasHeight;
        const endX = endPoint.x * canvasWidth;
        const endY = endPoint.y * canvasHeight;

        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
      }
    }

    ctx.stroke();

    // Draw keypoints
    ctx.fillStyle = '#ff0000';
    for (const keypoint of keypoints) {
      if ((keypoint.v || 0) > 0.5) {
        const x = keypoint.x * canvasWidth;
        const y = keypoint.y * canvasHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Draw key joint labels for debugging
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    const keyJoints = [
      POSE_LANDMARKS.LEFT_SHOULDER,
      POSE_LANDMARKS.RIGHT_SHOULDER,
      POSE_LANDMARKS.LEFT_HIP,
      POSE_LANDMARKS.RIGHT_HIP,
    ];

    for (const jointName of keyJoints) {
      const joint = keypointMap.get(jointName);
      if (joint && (joint.v || 0) > 0.5) {
        const x = joint.x * canvasWidth;
        const y = joint.y * canvasHeight;
        ctx.fillText(jointName.split('_')[1], x, y - 10);
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={`absolute top-0 left-0 pointer-events-none ${className}`}
      style={{
        width: `${width}px`,
        height: `${height}px`,
      }}
    />
  );
};
