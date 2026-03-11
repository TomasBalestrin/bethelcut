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

  // Recommended threshold: place it at 50% between noise floor and speech level
  // This gives a balanced detection — not too aggressive, not too conservative
  const gap = effectiveSpeechDb - effectiveNoiseDb;
  const recommendedThresholdDb = Math.round(
    effectiveNoiseDb + gap * 0.5
  );

  // Analyze speech segments to determine tempo
  const thresholdForAnalysis = recommendedThresholdDb;
  let inSpeech = false;
  let speechSegmentCount = 0;
  let totalSpeechDuration = 0;
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
 * Primary silence detection using dB analysis (waveform-based).
 * This is the reliable core — works without any external API.
 *
 * Uses a smoothing window to avoid false positives from momentary dips.
 */
export interface SmartSilenceRegion {
  startMs: number;
  endMs: number;
  durationMs: number;
  avgDb: number;
  type: 'silence' | 'filler';
  label: string;
}

export function detectSilenceFromWaveform(
  waveformData: number[],
  samplesPerSecond: number,
  thresholdDb: number,
  minDurationMs: number,
  paddingMs: number
): SmartSilenceRegion[] {
  const msPerSample = 1000 / samplesPerSecond;
  const regions: SmartSilenceRegion[] = [];

  // Use a smoothing window (50ms) to avoid false triggers from momentary dips
  const smoothWindowSamples = Math.max(1, Math.round((50 / 1000) * samplesPerSecond));

  let silenceStart: number | null = null;
  let dbAccumulator = 0;
  let dbCount = 0;

  for (let i = 0; i < waveformData.length; i++) {
    // Calculate smoothed dB over window
    let windowSum = 0;
    let windowCount = 0;
    const windowStart = Math.max(0, i - Math.floor(smoothWindowSamples / 2));
    const windowEnd = Math.min(waveformData.length - 1, i + Math.floor(smoothWindowSamples / 2));
    for (let j = windowStart; j <= windowEnd; j++) {
      windowSum += waveformData[j];
      windowCount++;
    }
    const smoothedAmplitude = windowSum / windowCount;
    const db = amplitudeToDb(smoothedAmplitude);
    const currentMs = i * msPerSample;

    if (db < thresholdDb) {
      if (silenceStart === null) {
        silenceStart = currentMs;
        dbAccumulator = 0;
        dbCount = 0;
      }
      if (db > -80) {
        dbAccumulator += db;
        dbCount++;
      }
    } else {
      if (silenceStart !== null) {
        const rawDuration = currentMs - silenceStart;
        if (rawDuration >= minDurationMs) {
          const avgDb = dbCount > 0 ? Math.round((dbAccumulator / dbCount) * 10) / 10 : -60;
          const paddedStart = Math.max(0, silenceStart + paddingMs);
          const paddedEnd = Math.max(paddedStart, currentMs - paddingMs);
          if (paddedEnd - paddedStart > 30) {
            regions.push({
              startMs: paddedStart,
              endMs: paddedEnd,
              durationMs: paddedEnd - paddedStart,
              avgDb,
              type: 'silence',
              label: `Silêncio (${avgDb.toFixed(1)} dB)`,
            });
          }
        }
        silenceStart = null;
      }
    }
  }

  // Handle trailing silence
  if (silenceStart !== null) {
    const endMs = waveformData.length * msPerSample;
    const rawDuration = endMs - silenceStart;
    if (rawDuration >= minDurationMs) {
      const avgDb = dbCount > 0 ? Math.round((dbAccumulator / dbCount) * 10) / 10 : -60;
      const paddedStart = Math.max(0, silenceStart + paddingMs);
      const paddedEnd = Math.max(paddedStart, endMs - paddingMs);
      if (paddedEnd - paddedStart > 30) {
        regions.push({
          startMs: paddedStart,
          endMs: paddedEnd,
          durationMs: paddedEnd - paddedStart,
          avgDb,
          type: 'silence',
          label: `Silêncio (${avgDb.toFixed(1)} dB)`,
        });
      }
    }
  }

  return regions;
}

/**
 * Refines silence regions using word-level transcription data.
 * Snaps cut boundaries to word edges for cleaner cuts.
 * Also detects filler words.
 *
 * This is an ENHANCEMENT — the base dB detection works without it.
 */
export function refineWithTranscription(
  silenceRegions: SmartSilenceRegion[],
  words: { word: string; startMs: number; endMs: number }[],
  paddingMs: number,
  includeFillers: boolean
): SmartSilenceRegion[] {
  if (words.length === 0) return silenceRegions;

  const refined = silenceRegions.map((region) => {
    // Find the closest word BEFORE the silence start
    let closestBefore: { word: string; endMs: number } | null = null;
    // Find the closest word AFTER the silence end
    let closestAfter: { word: string; startMs: number } | null = null;

    for (const w of words) {
      if (w.endMs <= region.startMs + paddingMs * 2 && w.endMs >= region.startMs - 200) {
        if (!closestBefore || w.endMs > closestBefore.endMs) {
          closestBefore = w;
        }
      }
      if (w.startMs >= region.endMs - paddingMs * 2 && w.startMs <= region.endMs + 200) {
        if (!closestAfter || w.startMs < closestAfter.startMs) {
          closestAfter = w;
        }
      }
    }

    // Snap to word boundaries (with padding)
    const snappedStart = closestBefore
      ? Math.max(region.startMs, closestBefore.endMs + paddingMs)
      : region.startMs;
    const snappedEnd = closestAfter
      ? Math.min(region.endMs, closestAfter.startMs - paddingMs)
      : region.endMs;

    // Build a better label
    const beforeLabel = closestBefore ? `"${closestBefore.word}"` : '...';
    const afterLabel = closestAfter ? `"${closestAfter.word}"` : '...';

    if (snappedEnd - snappedStart < 30) return null;

    return {
      ...region,
      startMs: snappedStart,
      endMs: snappedEnd,
      durationMs: snappedEnd - snappedStart,
      label: `${beforeLabel} → ${afterLabel}`,
    };
  }).filter((r): r is SmartSilenceRegion => r !== null);

  // Detect filler words and add them if not already inside a silence region
  if (includeFillers) {
    const FILLER_WORDS = ['é', 'hm', 'hmm', 'um', 'uh', 'ah', 'eh', 'tipo', 'né', 'então', 'assim', 'enfim'];
    for (const w of words) {
      const cleaned = w.word.toLowerCase().replace(/[.,!?;:]/g, '');
      if (FILLER_WORDS.includes(cleaned)) {
        const alreadyCovered = refined.some(
          (r) => r.startMs <= w.startMs && r.endMs >= w.endMs
        );
        if (!alreadyCovered) {
          refined.push({
            startMs: w.startMs,
            endMs: w.endMs,
            durationMs: w.endMs - w.startMs,
            avgDb: 0,
            type: 'filler',
            label: `Filler: "${w.word}"`,
          });
        }
      }
    }
    refined.sort((a, b) => a.startMs - b.startMs);
  }

  return refined;
}

// Keep legacy exports for backward compatibility with SilenceCutPanel
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

    if (gapDuration <= 50) continue;

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

export function generateSmartCutRegions(
  gaps: TranscriptionGap[],
  minGapMs: number = 200,
  paddingMs: number = 80
): { startMs: number; endMs: number }[] {
  const cuttableGaps = gaps.filter(
    (g) => g.isSilent && g.durationMs >= minGapMs
  );

  if (cuttableGaps.length === 0) return [];

  const regions = cuttableGaps.map((g) => ({
    startMs: Math.max(0, g.startMs + paddingMs),
    endMs: Math.max(g.startMs + paddingMs, g.endMs - paddingMs),
  }));

  const validRegions = regions.filter((r) => r.endMs - r.startMs > 30);

  if (validRegions.length <= 1) return validRegions;

  const sorted = [...validRegions].sort((a, b) => a.startMs - b.startMs);
  const merged: { startMs: number; endMs: number }[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].startMs <= last.endMs + 100) {
      last.endMs = Math.max(last.endMs, sorted[i].endMs);
    } else {
      merged.push(sorted[i]);
    }
  }

  return merged;
}
