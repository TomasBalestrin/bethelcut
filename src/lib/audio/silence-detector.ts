import { amplitudeToDb } from './waveform';

export interface SilenceRegion {
  startMs: number;
  endMs: number;
  type: 'silence' | 'filler';
  confidence: number;
}

export interface SilenceDetectionOptions {
  thresholdDb: number;
  minDurationMs: number;
  paddingMs: number;
  sampleRate: number;
}

export function detectSilenceRegions(
  waveformData: number[],
  samplesPerSecond: number,
  options: SilenceDetectionOptions
): SilenceRegion[] {
  const { thresholdDb, minDurationMs, paddingMs } = options;
  const regions: SilenceRegion[] = [];

  let silenceStart: number | null = null;
  const msPerSample = 1000 / samplesPerSecond;

  for (let i = 0; i < waveformData.length; i++) {
    const db = amplitudeToDb(waveformData[i]);
    const currentMs = i * msPerSample;

    if (db < thresholdDb) {
      if (silenceStart === null) {
        silenceStart = currentMs;
      }
    } else {
      if (silenceStart !== null) {
        const duration = currentMs - silenceStart;
        if (duration >= minDurationMs) {
          regions.push({
            startMs: Math.max(0, silenceStart + paddingMs),
            endMs: Math.max(silenceStart + paddingMs, currentMs - paddingMs),
            type: 'silence',
            confidence: 0.9,
          });
        }
        silenceStart = null;
      }
    }
  }

  // Handle trailing silence
  if (silenceStart !== null) {
    const endMs = waveformData.length * msPerSample;
    const duration = endMs - silenceStart;
    if (duration >= minDurationMs) {
      regions.push({
        startMs: Math.max(0, silenceStart + paddingMs),
        endMs: Math.max(silenceStart + paddingMs, endMs - paddingMs),
        type: 'silence',
        confidence: 0.9,
      });
    }
  }

  return regions;
}
