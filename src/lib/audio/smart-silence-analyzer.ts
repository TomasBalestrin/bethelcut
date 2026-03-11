import { amplitudeToDb } from './waveform';

export interface AudioProfile {
  noiseFloorDb: number;
  speechLevelDb: number;
  recommendedThresholdDb: number;
  recommendedMinDurationMs: number;
  recommendedPaddingMs: number;
  avgSpeechPaceMs: number;
  totalDurationMs: number;
  speechPercentage: number;
  silencePercentage: number;
}

/**
 * Analyzes waveform data to automatically determine optimal silence detection settings.
 *
 * Algorithm:
 * 1. Build a histogram of dB levels across all samples
 * 2. Identify the noise floor (most common low dB level cluster)
 * 3. Identify the speech level (most common high dB level cluster)
 * 4. Set threshold between noise floor and speech level
 * 5. Analyze speech patterns to determine min duration and padding
 */
export function analyzeAudioProfile(
  waveformData: number[],
  samplesPerSecond: number
): AudioProfile {
  const msPerSample = 1000 / samplesPerSecond;
  const totalDurationMs = waveformData.length * msPerSample;

  // Convert all samples to dB and filter out -Infinity
  const dbValues = waveformData
    .map((amp) => amplitudeToDb(amp))
    .filter((db) => db > -80);

  if (dbValues.length === 0) {
    return {
      noiseFloorDb: -50,
      speechLevelDb: -10,
      recommendedThresholdDb: -35,
      recommendedMinDurationMs: 500,
      recommendedPaddingMs: 150,
      avgSpeechPaceMs: 500,
      totalDurationMs,
      speechPercentage: 0,
      silencePercentage: 100,
    };
  }

  // Build histogram with 1dB bins from -80 to 0
  const histBins = 80;
  const histogram = new Array(histBins).fill(0);
  for (const db of dbValues) {
    const bin = Math.min(histBins - 1, Math.max(0, Math.floor(db + 80)));
    histogram[bin]++;
  }

  // Find noise floor: the peak in the lower half of the histogram (bins 0-39, i.e. -80 to -40 dB)
  let noiseFloorBin = 0;
  let noiseFloorCount = 0;
  for (let i = 0; i < 40; i++) {
    if (histogram[i] > noiseFloorCount) {
      noiseFloorCount = histogram[i];
      noiseFloorBin = i;
    }
  }
  const noiseFloorDb = noiseFloorBin - 80;

  // Find speech level: the peak in the upper half of the histogram (bins 40-79, i.e. -40 to 0 dB)
  let speechBin = 60;
  let speechCount = 0;
  for (let i = 40; i < histBins; i++) {
    if (histogram[i] > speechCount) {
      speechCount = histogram[i];
      speechBin = i;
    }
  }
  const speechLevelDb = speechBin - 80;

  // If no clear speech peak was found, use a reasonable default
  const effectiveSpeechDb = speechCount > 0 ? speechLevelDb : -15;
  const effectiveNoiseDb = noiseFloorCount > 0 ? noiseFloorDb : -50;

  // Recommended threshold: place it at 30% between noise floor and speech level
  // This biases towards capturing more silence (closer to noise floor)
  const gap = effectiveSpeechDb - effectiveNoiseDb;
  const recommendedThresholdDb = Math.round(
    effectiveNoiseDb + gap * 0.35
  );

  // Analyze speech segments to determine tempo
  const thresholdForAnalysis = recommendedThresholdDb;
  let inSpeech = false;
  let speechSegmentCount = 0;
  let totalSpeechDuration = 0;
  let totalSilenceDuration = 0;
  let segmentStart = 0;
  const speechDurations: number[] = [];
  const silenceDurations: number[] = [];

  for (let i = 0; i < waveformData.length; i++) {
    const db = amplitudeToDb(waveformData[i]);
    const currentMs = i * msPerSample;

    if (db >= thresholdForAnalysis) {
      if (!inSpeech) {
        // Speech started
        if (speechSegmentCount > 0) {
          const silDuration = currentMs - segmentStart;
          silenceDurations.push(silDuration);
          totalSilenceDuration += silDuration;
        }
        inSpeech = true;
        segmentStart = currentMs;
        speechSegmentCount++;
      }
    } else {
      if (inSpeech) {
        // Speech ended
        const speechDuration = currentMs - segmentStart;
        speechDurations.push(speechDuration);
        totalSpeechDuration += speechDuration;
        inSpeech = false;
        segmentStart = currentMs;
      }
    }
  }

  // Handle trailing speech
  if (inSpeech) {
    const speechDuration = totalDurationMs - segmentStart;
    speechDurations.push(speechDuration);
    totalSpeechDuration += speechDuration;
  } else if (speechSegmentCount > 0) {
    const silDuration = totalDurationMs - segmentStart;
    silenceDurations.push(silDuration);
    totalSilenceDuration += silDuration;
  }

  // Calculate average speech pace (average duration of speech segments)
  const avgSpeechPaceMs =
    speechDurations.length > 0
      ? speechDurations.reduce((a, b) => a + b, 0) / speechDurations.length
      : 500;

  // Recommended min duration: based on the median silence duration
  // We want to catch most silences but not tiny gaps within speech
  let recommendedMinDurationMs = 500;
  if (silenceDurations.length > 0) {
    const sortedSilences = [...silenceDurations].sort((a, b) => a - b);
    const medianSilence = sortedSilences[Math.floor(sortedSilences.length * 0.3)];
    // Use 60% of median silence or minimum 200ms
    recommendedMinDurationMs = Math.max(200, Math.min(2000, Math.round(medianSilence * 0.6)));
  }

  // Recommended padding: based on speech tempo
  // Faster speech = less padding needed, slower = more
  const recommendedPaddingMs = Math.round(
    Math.max(50, Math.min(300, avgSpeechPaceMs * 0.08))
  );

  const speechPercentage =
    totalDurationMs > 0
      ? Math.round((totalSpeechDuration / totalDurationMs) * 100)
      : 0;

  return {
    noiseFloorDb: effectiveNoiseDb,
    speechLevelDb: effectiveSpeechDb,
    recommendedThresholdDb: Math.max(-60, Math.min(-10, recommendedThresholdDb)),
    recommendedMinDurationMs,
    recommendedPaddingMs,
    avgSpeechPaceMs: Math.round(avgSpeechPaceMs),
    totalDurationMs,
    speechPercentage,
    silencePercentage: 100 - speechPercentage,
  };
}

/**
 * Uses transcription word timings combined with waveform data
 * to create precise cut regions.
 *
 * This is the core of the "AI CUT" feature - it uses word-level timestamps
 * from the transcription to precisely identify where speech starts/ends,
 * then validates against dB levels to ensure accuracy.
 */
export interface TranscriptionGap {
  startMs: number;
  endMs: number;
  durationMs: number;
  avgDb: number;
  isSilent: boolean;
  beforeWord: string;
  afterWord: string;
}

export function analyzeTranscriptionGaps(
  words: { word: string; startMs: number; endMs: number }[],
  waveformData: number[],
  samplesPerSecond: number,
  noiseThresholdDb: number
): TranscriptionGap[] {
  if (words.length < 2) return [];

  const msPerSample = 1000 / samplesPerSecond;
  const gaps: TranscriptionGap[] = [];

  for (let i = 0; i < words.length - 1; i++) {
    const gapStart = words[i].endMs;
    const gapEnd = words[i + 1].startMs;
    const gapDuration = gapEnd - gapStart;

    // Only consider gaps > 50ms (natural micro-pauses are shorter)
    if (gapDuration <= 50) continue;

    // Measure average dB in the gap region from waveform
    const startSample = Math.floor(gapStart / msPerSample);
    const endSample = Math.min(
      waveformData.length - 1,
      Math.ceil(gapEnd / msPerSample)
    );

    let totalDb = 0;
    let sampleCount = 0;
    for (let j = startSample; j <= endSample; j++) {
      if (j >= 0 && j < waveformData.length) {
        const db = amplitudeToDb(waveformData[j]);
        if (db > -80) {
          totalDb += db;
          sampleCount++;
        }
      }
    }

    const avgDb = sampleCount > 0 ? totalDb / sampleCount : -60;

    gaps.push({
      startMs: gapStart,
      endMs: gapEnd,
      durationMs: gapDuration,
      avgDb: Math.round(avgDb * 10) / 10,
      isSilent: avgDb < noiseThresholdDb,
      beforeWord: words[i].word,
      afterWord: words[i + 1].word,
    });
  }

  return gaps;
}

/**
 * Generates optimized cut regions by combining transcription gaps
 * with a minimum gap threshold. Merges adjacent small gaps.
 */
export function generateSmartCutRegions(
  gaps: TranscriptionGap[],
  minGapMs: number = 200,
  paddingMs: number = 80
): { startMs: number; endMs: number }[] {
  // Filter gaps that are silent and above minimum duration
  const cuttableGaps = gaps.filter(
    (g) => g.isSilent && g.durationMs >= minGapMs
  );

  if (cuttableGaps.length === 0) return [];

  // Apply padding to each gap
  const regions = cuttableGaps.map((g) => ({
    startMs: Math.max(0, g.startMs + paddingMs),
    endMs: Math.max(g.startMs + paddingMs, g.endMs - paddingMs),
  }));

  // Filter out regions that became too small after padding
  const validRegions = regions.filter((r) => r.endMs - r.startMs > 30);

  // Merge overlapping regions
  if (validRegions.length <= 1) return validRegions;

  const sorted = [...validRegions].sort((a, b) => a.startMs - b.startMs);
  const merged: { startMs: number; endMs: number }[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].startMs <= last.endMs + 100) {
      // Merge if within 100ms
      last.endMs = Math.max(last.endMs, sorted[i].endMs);
    } else {
      merged.push(sorted[i]);
    }
  }

  return merged;
}
