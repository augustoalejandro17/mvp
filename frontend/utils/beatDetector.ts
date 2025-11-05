// @ts-ignore - Meyda doesn't have proper TypeScript definitions
import Meyda from 'meyda';

export interface BeatDetectionResult {
  bpm?: number;
  onsets: number[]; // timestamps in seconds
  confidence: number; // 0-1
}

export async function detectBeatsFromVideo(videoFile: File): Promise<BeatDetectionResult> {
  try {
    // Create audio context
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Read the file as array buffer
    const arrayBuffer = await videoFile.arrayBuffer();
    
    // Decode audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    // Convert to mono if stereo
    const audioData = audioBuffer.numberOfChannels > 1 
      ? mergeChannels(audioBuffer)
      : audioBuffer.getChannelData(0);
    
    // Configure Meyda
    Meyda.audioContext = audioContext;
    Meyda.sampleRate = audioBuffer.sampleRate;
    Meyda.bufferSize = 512;
    
    const windowSize = 1024;
    const hopSize = 512;
    const numWindows = Math.floor((audioData.length - windowSize) / hopSize);
    
    const spectralFlux: number[] = [];
    const timeStamps: number[] = [];
    
    // Calculate spectral flux for onset detection
    let previousSpectrum: number[] | null = null;
    
    for (let i = 0; i < numWindows; i++) {
      const startSample = i * hopSize;
      const windowData = audioData.slice(startSample, startSample + windowSize);
      
      // Calculate spectrum using Meyda
      const features = Meyda.extract(['spectralCentroid', 'mfcc'], windowData);
      
      if (features && previousSpectrum) {
        // Simple spectral flux calculation
        let flux = 0;
        const currentSpectrum = features.mfcc || [];
        
        for (let j = 0; j < Math.min(currentSpectrum.length, previousSpectrum.length); j++) {
          const diff = currentSpectrum[j] - previousSpectrum[j];
          if (diff > 0) {
            flux += diff;
          }
        }
        
        spectralFlux.push(flux);
        timeStamps.push(startSample / audioBuffer.sampleRate);
      }
      
      if (features && features.mfcc) {
        previousSpectrum = features.mfcc;
      }
    }
    
    // Find peaks in spectral flux (onsets)
    const onsets = findPeaks(spectralFlux, timeStamps);
    
    // Estimate BPM from onset intervals
    const bpm = estimateBPM(onsets);
    
    // Calculate confidence based on regularity of onsets
    const confidence = calculateOnsetConfidence(onsets, bpm);
    
    return {
      bpm,
      onsets,
      confidence,
    };
  } catch (error) {
    console.error('Beat detection failed:', error);
    return {
      onsets: [],
      confidence: 0,
    };
  }
}

function mergeChannels(audioBuffer: AudioBuffer): Float32Array {
  const length = audioBuffer.length;
  const merged = new Float32Array(length);
  
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      sum += audioBuffer.getChannelData(channel)[i];
    }
    merged[i] = sum / audioBuffer.numberOfChannels;
  }
  
  return merged;
}

function findPeaks(data: number[], timeStamps: number[], threshold: number = 0.1): number[] {
  const peaks: number[] = [];
  const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
  const adaptiveThreshold = mean + threshold * Math.max(...data);
  
  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > data[i - 1] && 
        data[i] > data[i + 1] && 
        data[i] > adaptiveThreshold) {
      peaks.push(timeStamps[i]);
    }
  }
  
  return peaks;
}

function estimateBPM(onsets: number[]): number | undefined {
  if (onsets.length < 4) return undefined;
  
  // Calculate intervals between onsets
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i] - onsets[i - 1]);
  }
  
  // Find the most common interval (mode)
  const intervalCounts = new Map<number, number>();
  const tolerance = 0.05; // 50ms tolerance
  
  for (const interval of intervals) {
    let found = false;
    for (const [key, count] of Array.from(intervalCounts.entries())) {
      if (Math.abs(interval - key) < tolerance) {
        intervalCounts.set(key, count + 1);
        found = true;
        break;
      }
    }
    if (!found) {
      intervalCounts.set(interval, 1);
    }
  }
  
  // Find most frequent interval
  let maxCount = 0;
  let mostCommonInterval = 0;
  
  for (const [interval, count] of Array.from(intervalCounts.entries())) {
    if (count > maxCount) {
      maxCount = count;
      mostCommonInterval = interval;
    }
  }
  
  if (mostCommonInterval > 0) {
    const bpm = 60 / mostCommonInterval;
    // Clamp to reasonable range for bachata (80-140 BPM)
    return Math.max(80, Math.min(140, Math.round(bpm)));
  }
  
  return undefined;
}

function calculateOnsetConfidence(onsets: number[], bpm?: number): number {
  if (!bpm || onsets.length < 4) return 0;
  
  const expectedInterval = 60 / bpm;
  const intervals: number[] = [];
  
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i] - onsets[i - 1]);
  }
  
  // Calculate how many intervals are close to expected
  const tolerance = expectedInterval * 0.2; // 20% tolerance
  let goodIntervals = 0;
  
  for (const interval of intervals) {
    if (Math.abs(interval - expectedInterval) < tolerance) {
      goodIntervals++;
    }
  }
  
  return goodIntervals / intervals.length;
}
