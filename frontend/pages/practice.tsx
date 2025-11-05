import React, { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { usePoseExtractor } from '../hooks/usePoseExtractor';
import { useSessionUser } from '../hooks/useSessionUser';
import { detectBeatsFromVideo } from '../utils/beatDetector';
import { analysisApi } from '../utils/analysis-api';
import { OverlayCanvas } from '../components/OverlayCanvas';
import { Timeline } from '../components/Timeline';
import { SessionCard } from '../components/SessionCard';
import { Frame, AnalysisInput, AnalysisResult } from '../types/bachata-analysis';

type AnalysisStep = 'upload' | 'processing' | 'results';

const PracticePage: React.FC = () => {
  const router = useRouter();
  const { user, isLoading: userLoading } = useSessionUser();
  const { extractPoseFromVideo, isProcessing, progress, error: poseError } = usePoseExtractor();

  const [step, setStep] = useState<AnalysisStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzeOnDevice, setAnalyzeOnDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Analysis results
  const [frames, setFrames] = useState<Frame[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [overallScore, setOverallScore] = useState(0);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  
  // Video playback
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentFrame, setCurrentFrame] = useState<Frame | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 480 });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file.');
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setError('Video file is too large. Please select a file smaller than 100MB.');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!selectedFile || !user) return;

    try {
      setIsAnalyzing(true);
      setStep('processing');
      setError(null);

      // Extract pose landmarks
      console.log('Extracting pose from video...');
      const extractedFrames = await extractPoseFromVideo(selectedFile);
      setFrames(extractedFrames);

      // Detect beats (optional)
      console.log('Detecting beats...');
      let bpm: number | undefined;
      try {
        const beatResult = await detectBeatsFromVideo(selectedFile);
        bpm = beatResult.bpm;
        console.log('Detected BPM:', bpm);
      } catch (beatError) {
        console.warn('Beat detection failed:', beatError);
      }

      // Create video element for playback
      const video = videoRef.current;
      if (video) {
        video.src = URL.createObjectURL(selectedFile);
        video.onloadedmetadata = () => {
          setVideoDimensions({
            width: video.videoWidth,
            height: video.videoHeight,
          });
        };
      }

      // Prepare analysis input
      const analysisInput: AnalysisInput = {
        source: 'client-landmarks',
        fps: 15, // We sampled at 15 FPS
        durationMs: extractedFrames.length > 0 
          ? extractedFrames[extractedFrames.length - 1].t 
          : selectedFile.size / 1000, // rough estimate
        bpm,
        frames: extractedFrames,
      };

      console.log('Sending analysis to server...');
      const response = await analysisApi.createAnalysis(analysisInput);
      
      setAnalysisResult(response.result);
      setAnalysisId(response.analysisId);
      
      // Calculate overall score (this should come from the server, but we'll calculate it here for now)
      const score = calculateOverallScore(response.result.metrics);
      setOverallScore(score);

      setStep('results');
    } catch (err) {
      console.error('Analysis failed:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed. Please try again.');
      setStep('upload');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const calculateOverallScore = (metrics: any) => {
    const timingScore = Math.max(0, 100 - Math.abs(metrics.timing_ms.mean) / 2);
    const weightTransferScore = metrics.weight_transfer_ratio * 100;
    const postureScore = Math.max(0, 100 - (metrics.posture_deg * 5));
    const hipScore = Math.min(100, (metrics.hip_amplitude_deg / 10) * 100);
    const smoothnessScore = metrics.smoothness * 100;

    return Math.round(
      timingScore * 0.3 +
      weightTransferScore * 0.25 +
      postureScore * 0.2 +
      hipScore * 0.15 +
      smoothnessScore * 0.1
    );
  };

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || frames.length === 0) return;

    const currentTimeMs = video.currentTime * 1000;
    setCurrentTime(currentTimeMs);

    // Find closest frame
    const closestFrame = frames.reduce((prev, curr) => 
      Math.abs(curr.t - currentTimeMs) < Math.abs(prev.t - currentTimeMs) ? curr : prev
    );
    
    setCurrentFrame(closestFrame);
  }, [frames]);

  const handleSeek = (timeMs: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = timeMs / 1000;
    }
  };

  const resetAnalysis = () => {
    setStep('upload');
    setSelectedFile(null);
    setFrames([]);
    setAnalysisResult(null);
    setOverallScore(0);
    setAnalysisId(null);
    setCurrentFrame(null);
    setCurrentTime(0);
    setError(null);
    
    if (videoRef.current) {
      videoRef.current.src = '';
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to continue</h1>
          <button 
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Bachata Coach</h1>
          <p className="text-lg text-gray-600">Analyze your dance and improve your technique</p>
        </div>

        {step === 'upload' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-2xl font-bold mb-6">Upload Your Dance Video</h2>
              
              {/* File Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="video-upload"
                />
                <label htmlFor="video-upload" className="cursor-pointer">
                  <div className="text-gray-400 mb-4">
                    <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-gray-700 mb-2">
                    Click to select your dance video
                  </p>
                  <p className="text-sm text-gray-500">
                    MP4, MOV, AVI up to 100MB • 30-60 seconds recommended
                  </p>
                </label>
              </div>

              {selectedFile && (
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Selected:</strong> {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                  </p>
                </div>
              )}

              {/* Analysis Options */}
              <div className="mt-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={analyzeOnDevice}
                    onChange={(e) => setAnalyzeOnDevice(e.target.checked)}
                    className="mr-3"
                  />
                  <span className="text-sm">
                    Analyze on device (recommended for privacy - only pose data sent to server)
                  </span>
                </label>
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!selectedFile || isAnalyzing}
                className={`w-full mt-6 py-3 px-6 rounded-lg font-medium ${
                  selectedFile && !isAnalyzing
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze My Dance'}
              </button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <h2 className="text-2xl font-bold mb-6">Analyzing Your Dance...</h2>
              
              <div className="mb-6">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  {isProcessing ? `Extracting pose: ${Math.round(progress)}%` : 'Processing analysis...'}
                </p>
              </div>

              <div className="text-left space-y-2 text-sm text-gray-600">
                <p>✓ Extracting pose landmarks from video</p>
                <p>✓ Detecting rhythm and beats</p>
                <p>✓ Computing dance metrics</p>
                <p>✓ Generating personalized feedback</p>
              </div>

              {poseError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800">{poseError}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'results' && analysisResult && (
          <div className="space-y-8">
            {/* Video Player with Overlay */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-2xl font-bold mb-4">Your Performance</h2>
              
              <div className="relative inline-block mx-auto">
                <video
                  ref={videoRef}
                  controls
                  onTimeUpdate={handleVideoTimeUpdate}
                  className="rounded-lg shadow-lg"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '400px',
                  }}
                />
                {currentFrame && (
                  <OverlayCanvas
                    frame={currentFrame}
                    videoElement={videoRef.current}
                    width={videoDimensions.width}
                    height={videoDimensions.height}
                  />
                )}
              </div>

              {/* Timeline */}
              <div className="mt-6">
                <Timeline
                  events={analysisResult.timeline}
                  durationMs={frames.length > 0 ? frames[frames.length - 1].t : 0}
                  currentTime={currentTime}
                  bpm={selectedFile ? undefined : undefined} // TODO: Get BPM from analysis
                  onSeek={handleSeek}
                />
              </div>
            </div>

            {/* Session Card */}
            <SessionCard
              result={analysisResult}
              overallScore={overallScore}
            />

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <button
                onClick={resetAnalysis}
                className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
              >
                Analyze Another Video
              </button>
              <button
                onClick={() => router.push('/progress')}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                View Progress
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticePage;
