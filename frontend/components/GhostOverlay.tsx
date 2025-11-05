import React, { useRef, useEffect } from 'react';
import { Frame, POSE_LANDMARKS } from '../types/bachata-analysis';

interface GhostOverlayProps {
  referenceFrame: Frame | null;
  studentFrame: Frame | null;
  width: number;
  height: number;
  className?: string;
}

const SKELETON_CONNECTIONS = [
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
];

export const GhostOverlay: React.FC<GhostOverlayProps> = ({
  referenceFrame,
  studentFrame,
  width,
  height,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw reference skeleton (green, semi-transparent)
    if (referenceFrame) {
      drawSkeleton(ctx, referenceFrame.keypoints, width, height, '#00ff00', 0.6);
    }

    // Draw student skeleton (blue, more opaque)
    if (studentFrame) {
      drawSkeleton(ctx, studentFrame.keypoints, width, height, '#0066ff', 0.8);
    }

    // Draw legend
    drawLegend(ctx, width, height);
  }, [referenceFrame, studentFrame, width, height]);

  const drawSkeleton = (
    ctx: CanvasRenderingContext2D,
    keypoints: any[],
    canvasWidth: number,
    canvasHeight: number,
    color: string,
    opacity: number
  ) => {
    const keypointMap = new Map<string, any>();
    keypoints.forEach(kp => keypointMap.set(kp.name, kp));

    // Set alpha for transparency
    ctx.globalAlpha = opacity;

    // Draw connections
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
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
    ctx.fillStyle = color;
    for (const keypoint of keypoints) {
      if ((keypoint.v || 0) > 0.5) {
        const x = keypoint.x * canvasWidth;
        const y = keypoint.y * canvasHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    // Reset alpha
    ctx.globalAlpha = 1;
  };

  const drawLegend = (ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
    const legendX = 10;
    const legendY = 10;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(legendX, legendY, 140, 60);

    // Reference indicator
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(legendX + 10, legendY + 10, 15, 3);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Arial';
    ctx.fillText('Reference', legendX + 30, legendY + 20);

    // Student indicator
    ctx.fillStyle = '#0066ff';
    ctx.fillRect(legendX + 10, legendY + 30, 15, 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('Your attempt', legendX + 30, legendY + 40);
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
