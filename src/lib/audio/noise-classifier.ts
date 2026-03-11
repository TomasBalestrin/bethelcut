import { amplitudeToDb } from './waveform';
import { type AudioProfile } from './smart-silence-analyzer';

// ─── Types ───────────────────────────────────────────────────

export interface AudioRegion {
  startMs: number;
  endMs: number;
}

export interface ClassifiedRegion {
  startMs: number;
  endMs: number;
  durationMs: number;
  type: 'silence' | 'noise' | 'filler';
  noiseType?: 'continuous' | 'impulsive' | 'ambient';
  label: string;
  avgDb: number;
  confidence: number;
}

interface RegionMetrics {
  avgDb: number;
  peakDb: number;
  rms: number;
  stdDev: number;
  crestFactor: number;
  zeroCrossingRate: number;
}

// ─── Speaker Rhythm Analysis ────────────────────────────────

/**
 * Learned rhythm profile for a specific speaker/video.
 * Used to determine what constitutes a "natural" pause vs excess silence.
 */
export interface SpeakerRhythm {
  /** Median gap between consecutive words (ms) */
  medianWordGapMs: number;
  /** 75th percentile word gap - upper bound of normal pauses */
  p75WordGapMs: number;
  /** 90th percentile word gap - sentence boundary territory */
  p90WordGapMs: number;
  /** Median gap at sentence boundaries (.!?) */
  medianSentenceGapMs: number;
  /** Average words per second - speech pace indicator */
  wordsPerSecond: number;
  /** Average speech segment energy (dB) - used for relative silence detection */
  avgSpeechEnergyDb: number;
  /** Standard deviation of gap durations - how variable the speaker is */
  gapVariability: number;
}

/**
 * Learns the natural rhythm of the speaker from word-level timestamps.
 * Analyzes pause patterns to understand what's "normal" for this specific video.
 */
export function learnSpeakerRhythm(
  words: { word: string; startMs: number; endMs: number }[],
  waveformData: number[],
  samplesPerSecond: number
): SpeakerRhythm {
  if (words.length < 2) {
    return {
      medianWordGapMs: 300,
      p75WordGapMs: 500,
      p90WordGapMs: 800,
      medianSentenceGapMs: 600,
      wordsPerSecond: 2.5,
      avgSpeechEnergyDb: -20,
      gapVariability: 200,
    };
  }

  const sorted = [...words].sort((a, b) => a.startMs - b.startMs);

  // Collect all inter-word gaps
  const wordGaps: number[] = [];
  const sentenceGaps: number[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1].startMs - sorted[i].endMs;
    if (gap > 0 && gap < 10000) { // ignore gaps > 10s (likely scene changes)
      wordGaps.push(gap);

      // Check if current word ends a sentence
      const w = sorted[i].word.trim();
      if (w.endsWith('.') || w.endsWith('!') || w.endsWith('?') || w.endsWith('...')) {
        sentenceGaps.push(gap);
      }
    }
  }

  // Compute percentiles
  const sortedGaps = [...wordGaps].sort((a, b) => a - b);
  const percentile = (arr: number[], p: number) => {
    if (arr.length === 0) return 300;
    const idx = Math.floor(arr.length * p);
    return arr[Math.min(idx, arr.length - 1)];
  };

  const medianWordGapMs = percentile(sortedGaps, 0.5);
  const p75WordGapMs = percentile(sortedGaps, 0.75);
  const p90WordGapMs = percentile(sortedGaps, 0.9);

  const sortedSentenceGaps = [...sentenceGaps].sort((a, b) => a - b);
  const medianSentenceGapMs = sentenceGaps.length > 0
    ? percentile(sortedSentenceGaps, 0.5)
    : p90WordGapMs;

  // Words per second
  const totalSpeechMs = sorted[sorted.length - 1].endMs - sorted[0].startMs;
  const wordsPerSecond = totalSpeechMs > 0 ? (sorted.length / (totalSpeechMs / 1000)) : 2.5;

  // Average speech energy from waveform during speech segments
  const msPerSample = 1000 / samplesPerSecond;
  let speechEnergySum = 0;
  let speechSampleCount = 0;
  for (const w of sorted) {
    const startIdx = Math.floor(w.startMs / msPerSample);
    const endIdx = Math.min(waveformData.length - 1, Math.ceil(w.endMs / msPerSample));
    for (let j = startIdx; j <= endIdx; j++) {
      if (j >= 0 && j < waveformData.length) {
        const db = amplitudeToDb(Math.max(0.00001, waveformData[j]));
        if (db > -60) {
          speechEnergySum += db;
          speechSampleCount++;
        }
      }
    }
  }
  const avgSpeechEnergyDb = speechSampleCount > 0 ? speechEnergySum / speechSampleCount : -20;

  // Gap variability (standard deviation)
  const meanGap = wordGaps.reduce((a, b) => a + b, 0) / wordGaps.length;
  const variance = wordGaps.reduce((s, g) => s + (g - meanGap) ** 2, 0) / wordGaps.length;
  const gapVariability = Math.sqrt(variance);

  return {
    medianWordGapMs,
    p75WordGapMs,
    p90WordGapMs,
    medianSentenceGapMs,
    wordsPerSecond,
    avgSpeechEnergyDb,
    gapVariability,
  };
}

// ─── Speech Mapping ──────────────────────────────────────────

/**
 * Converts word-level timestamps from Whisper into contiguous speech regions.
 * Groups words that are close together (gap < groupingGapMs) into single blocks.
 * Applies padding to protect speech boundaries from being cut.
 */
export function mapSpeechRegions(
  words: { word: string; startMs: number; endMs: number }[],
  paddingMs: number,
  groupingGapMs: number = 120
): AudioRegion[] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.startMs - b.startMs);

  // Group words into contiguous speech blocks
  const blocks: AudioRegion[] = [];
  let blockStart = sorted[0].startMs;
  let blockEnd = sorted[0].endMs;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].startMs - blockEnd;
    if (gap <= groupingGapMs) {
      // Continue the current block
      blockEnd = Math.max(blockEnd, sorted[i].endMs);
    } else {
      // Close current block, start new one
      blocks.push({ startMs: blockStart, endMs: blockEnd });
      blockStart = sorted[i].startMs;
      blockEnd = sorted[i].endMs;
    }
  }
  // Close last block
  blocks.push({ startMs: blockStart, endMs: blockEnd });

  // Apply padding (expand speech regions to protect boundaries)
  return blocks.map((b) => ({
    startMs: Math.max(0, b.startMs - paddingMs),
    endMs: b.endMs + paddingMs,
  }));
}

// ─── Candidate Zone Extraction ───────────────────────────────

/**
 * Returns the inverse of speech regions — all time ranges NOT covered by speech.
 * These are candidate zones for silence/noise detection.
 */
export function extractCandidateZones(
  speechRegions: AudioRegion[],
  totalDurationMs: number,
  minZoneDurationMs: number = 50
): AudioRegion[] {
  if (speechRegions.length === 0) {
    return [{ startMs: 0, endMs: totalDurationMs }];
  }

  // Merge overlapping speech regions first
  const sorted = [...speechRegions].sort((a, b) => a.startMs - b.startMs);
  const merged: AudioRegion[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    if (sorted[i].startMs <= last.endMs) {
      last.endMs = Math.max(last.endMs, sorted[i].endMs);
    } else {
      merged.push({ ...sorted[i] });
    }
  }

  // Extract gaps between speech regions
  const zones: AudioRegion[] = [];

  // Gap before first speech
  if (merged[0].startMs > 0) {
    zones.push({ startMs: 0, endMs: merged[0].startMs });
  }

  // Gaps between speech blocks
  for (let i = 0; i < merged.length - 1; i++) {
    const gapStart = merged[i].endMs;
    const gapEnd = merged[i + 1].startMs;
    if (gapEnd > gapStart) {
      zones.push({ startMs: gapStart, endMs: gapEnd });
    }
  }

  // Gap after last speech
  const lastSpeech = merged[merged.length - 1];
  if (lastSpeech.endMs < totalDurationMs) {
    zones.push({ startMs: lastSpeech.endMs, endMs: totalDurationMs });
  }

  // Filter out very short zones
  return zones.filter((z) => z.endMs - z.startMs >= minZoneDurationMs);
}

// ─── Audio Metrics ───────────────────────────────────────────

/**
 * Calculates detailed audio metrics for a specific time region.
 * Uses waveform amplitude data (normalized 0-1).
 */
function calculateRegionMetrics(
  waveformData: number[],
  samplesPerSecond: number,
  region: AudioRegion
): RegionMetrics {
  const msPerSample = 1000 / samplesPerSecond;
  const startIdx = Math.max(0, Math.floor(region.startMs / msPerSample));
  const endIdx = Math.min(waveformData.length - 1, Math.ceil(region.endMs / msPerSample));

  if (endIdx <= startIdx) {
    return { avgDb: -60, peakDb: -60, rms: 0, stdDev: 0, crestFactor: 1, zeroCrossingRate: 0 };
  }

  const samples = waveformData.slice(startIdx, endIdx + 1);
  const n = samples.length;

  // Average and peak amplitude
  let sum = 0;
  let sumSquares = 0;
  let peak = 0;

  for (let i = 0; i < n; i++) {
    sum += samples[i];
    sumSquares += samples[i] * samples[i];
    if (samples[i] > peak) peak = samples[i];
  }

  const mean = sum / n;
  const rms = Math.sqrt(sumSquares / n);

  // Standard deviation
  let varianceSum = 0;
  for (let i = 0; i < n; i++) {
    const diff = samples[i] - mean;
    varianceSum += diff * diff;
  }
  const stdDev = Math.sqrt(varianceSum / n);

  // Crest factor: peak / RMS (high = transient/impulsive)
  const crestFactor = rms > 0.0001 ? peak / rms : 1;

  // Zero-crossing rate: how often the signal crosses the mean level
  // (proxy for frequency content without FFT)
  let zeroCrossings = 0;
  for (let i = 1; i < n; i++) {
    const prev = samples[i - 1] - mean;
    const curr = samples[i] - mean;
    if ((prev >= 0 && curr < 0) || (prev < 0 && curr >= 0)) {
      zeroCrossings++;
    }
  }
  const durationSec = (region.endMs - region.startMs) / 1000;
  const zeroCrossingRate = durationSec > 0 ? zeroCrossings / durationSec : 0;

  // dB values
  const avgDb = amplitudeToDb(Math.max(0.00001, mean));
  const peakDb = amplitudeToDb(Math.max(0.00001, peak));

  return { avgDb, peakDb, rms, stdDev, crestFactor, zeroCrossingRate };
}

// ─── Adaptive Local Energy Analysis ─────────────────────────

/**
 * Analyzes the energy contour within a candidate zone using sliding windows.
 * Returns sub-regions where energy drops significantly below surrounding speech.
 * This catches silences that a global threshold would miss.
 */
function findSilenceCores(
  waveformData: number[],
  samplesPerSecond: number,
  region: AudioRegion,
  profile: AudioProfile,
  rhythm: SpeakerRhythm
): { startMs: number; endMs: number; avgDb: number }[] {
  const msPerSample = 1000 / samplesPerSecond;
  const startIdx = Math.max(0, Math.floor(region.startMs / msPerSample));
  const endIdx = Math.min(waveformData.length - 1, Math.ceil(region.endMs / msPerSample));

  if (endIdx - startIdx < 3) return [];

  // Use 50ms energy windows for fine-grained analysis
  const windowMs = 50;
  const windowSamples = Math.max(1, Math.round((windowMs / 1000) * samplesPerSecond));

  // Build energy contour (dB per window)
  const energyContour: { ms: number; db: number }[] = [];
  for (let i = startIdx; i < endIdx; i += windowSamples) {
    const winEnd = Math.min(i + windowSamples, endIdx);
    let sumSq = 0;
    let count = 0;
    for (let j = i; j < winEnd; j++) {
      sumSq += waveformData[j] * waveformData[j];
      count++;
    }
    const rms = Math.sqrt(sumSq / count);
    const db = amplitudeToDb(Math.max(0.00001, rms));
    energyContour.push({ ms: i * msPerSample, db });
  }

  if (energyContour.length === 0) return [];

  // Adaptive threshold: use the greater of:
  // 1. Global noise floor + 6dB (original approach)
  // 2. Speech energy - dynamic drop threshold (relative to speaker)
  //    The drop threshold adapts: louder speakers need bigger drops
  const globalThreshold = profile.noiseFloorDb + 6;
  const dropFromSpeech = Math.max(12, (rhythm.avgSpeechEnergyDb - profile.noiseFloorDb) * 0.5);
  const relativeThreshold = rhythm.avgSpeechEnergyDb - dropFromSpeech;
  const adaptiveThreshold = Math.max(globalThreshold, relativeThreshold);

  // Find contiguous runs of windows below adaptive threshold
  const cores: { startMs: number; endMs: number; avgDb: number }[] = [];
  let coreStart: number | null = null;
  let dbSum = 0;
  let dbCount = 0;

  for (let i = 0; i < energyContour.length; i++) {
    if (energyContour[i].db < adaptiveThreshold) {
      if (coreStart === null) {
        coreStart = energyContour[i].ms;
        dbSum = 0;
        dbCount = 0;
      }
      dbSum += energyContour[i].db;
      dbCount++;
    } else {
      if (coreStart !== null && dbCount > 0) {
        const coreEnd = energyContour[i].ms;
        cores.push({
          startMs: coreStart,
          endMs: coreEnd,
          avgDb: dbSum / dbCount,
        });
        coreStart = null;
      }
    }
  }

  // Handle trailing core
  if (coreStart !== null && dbCount > 0) {
    cores.push({
      startMs: coreStart,
      endMs: energyContour[energyContour.length - 1].ms + windowMs,
      avgDb: dbSum / dbCount,
    });
  }

  return cores;
}

// ─── Region Classification ───────────────────────────────────

/**
 * Classifies a single non-speech region using adaptive analysis.
 *
 * Key improvements over fixed-threshold approach:
 * 1. Uses adaptive threshold based on speaker's energy profile
 * 2. Finds silence cores within noisy zones (sub-region analysis)
 * 3. Classifies noise type using multi-metric analysis
 */
function classifyRegion(
  waveformData: number[],
  samplesPerSecond: number,
  region: AudioRegion,
  profile: AudioProfile,
  rhythm: SpeakerRhythm
): ClassifiedRegion[] {
  const metrics = calculateRegionMetrics(waveformData, samplesPerSecond, region);
  const durationMs = region.endMs - region.startMs;

  // Adaptive silence threshold: combines global noise floor with speaker-relative drop
  const dropFromSpeech = Math.max(12, (rhythm.avgSpeechEnergyDb - profile.noiseFloorDb) * 0.5);
  const relativeThreshold = rhythm.avgSpeechEnergyDb - dropFromSpeech;
  const globalThreshold = profile.noiseFloorDb + 6;
  const silenceThresholdDb = Math.max(globalThreshold, relativeThreshold);

  // If the whole region is clearly below threshold → simple silence
  if (metrics.avgDb < silenceThresholdDb) {
    return [{
      startMs: region.startMs,
      endMs: region.endMs,
      durationMs,
      type: 'silence',
      label: `Silêncio (${metrics.avgDb.toFixed(1)} dB)`,
      avgDb: metrics.avgDb,
      confidence: 0.95,
    }];
  }

  // The region as a whole is above threshold, but it may contain
  // silence CORES within it (e.g., a noisy zone with quiet segments)
  const results: ClassifiedRegion[] = [];

  // Find silence sub-regions within this candidate zone
  const silenceCores = findSilenceCores(waveformData, samplesPerSecond, region, profile, rhythm);
  const significantCores = silenceCores.filter(c => (c.endMs - c.startMs) >= 100);

  if (significantCores.length > 0) {
    for (const core of significantCores) {
      const coreDuration = core.endMs - core.startMs;
      results.push({
        startMs: core.startMs,
        endMs: core.endMs,
        durationMs: coreDuration,
        type: 'silence',
        label: `Silêncio (${core.avgDb.toFixed(1)} dB)`,
        avgDb: core.avgDb,
        confidence: 0.85,
      });
    }
  }

  // Classify the overall region as noise (or the non-silence parts)
  // Only add as noise if we didn't already extract silence cores covering most of it
  const silenceCoverage = significantCores.reduce((s, c) => s + (c.endMs - c.startMs), 0);
  const remainingDuration = durationMs - silenceCoverage;

  if (remainingDuration > 100) {
    // Classify the noise type
    const dbAboveFloor = metrics.avgDb - profile.noiseFloorDb;
    const dbRange = profile.speechLevelDb - profile.noiseFloorDb;
    const relativeLevel = dbRange > 0 ? dbAboveFloor / dbRange : 0.5;

    const isImpulsive = metrics.crestFactor > 4 && metrics.stdDev > 0.05;
    const isContinuous = metrics.crestFactor < 2.5 && metrics.stdDev < 0.03;

    let noiseType: 'continuous' | 'impulsive' | 'ambient';
    let noiseLabel: string;
    let confidence: number;

    if (isImpulsive) {
      noiseType = 'impulsive';
      noiseLabel = metrics.zeroCrossingRate > 200
        ? `Ruído impulsivo agudo (${metrics.avgDb.toFixed(1)} dB)`
        : `Ruído impulsivo (${metrics.avgDb.toFixed(1)} dB)`;
      confidence = Math.min(0.95, 0.7 + relativeLevel * 0.25);
    } else if (isContinuous) {
      noiseType = 'continuous';
      noiseLabel = metrics.zeroCrossingRate < 50
        ? `Ruído contínuo grave (${metrics.avgDb.toFixed(1)} dB)`
        : `Ruído contínuo (${metrics.avgDb.toFixed(1)} dB)`;
      confidence = Math.min(0.9, 0.65 + relativeLevel * 0.25);
    } else {
      noiseType = 'ambient';
      noiseLabel = `Ruído ambiente (${metrics.avgDb.toFixed(1)} dB)`;
      confidence = Math.min(0.85, 0.6 + relativeLevel * 0.2);
    }

    // If we extracted some silence cores, only add noise for the remaining parts
    if (significantCores.length === 0) {
      results.push({
        startMs: region.startMs,
        endMs: region.endMs,
        durationMs,
        type: 'noise',
        noiseType,
        label: noiseLabel,
        avgDb: metrics.avgDb,
        confidence,
      });
    } else {
      // Add noise segments for the gaps between silence cores
      let cursor = region.startMs;
      for (const core of significantCores) {
        if (core.startMs - cursor > 100) {
          const segMetrics = calculateRegionMetrics(waveformData, samplesPerSecond, { startMs: cursor, endMs: core.startMs });
          results.push({
            startMs: cursor,
            endMs: core.startMs,
            durationMs: core.startMs - cursor,
            type: 'noise',
            noiseType,
            label: noiseLabel,
            avgDb: segMetrics.avgDb,
            confidence: confidence * 0.9,
          });
        }
        cursor = core.endMs;
      }
      if (region.endMs - cursor > 100) {
        const segMetrics = calculateRegionMetrics(waveformData, samplesPerSecond, { startMs: cursor, endMs: region.endMs });
        results.push({
          startMs: cursor,
          endMs: region.endMs,
          durationMs: region.endMs - cursor,
          type: 'noise',
          noiseType,
          label: noiseLabel,
          avgDb: segMetrics.avgDb,
          confidence: confidence * 0.9,
        });
      }
    }
  }

  return results;
}

// ─── Harmonic Trimming ──────────────────────────────────────

/**
 * Configuration for rhythm-aware adaptive detection.
 * Instead of fixed ms values, uses multipliers of the speaker's natural rhythm.
 */
export interface AdaptiveConfig {
  /** How much of the natural pause to preserve (0-1). 1.0 = keep full natural pause */
  naturalPauseKeepRatio: number;
  /** Only cut pauses that exceed this percentile of the speaker's gaps */
  cutThresholdPercentile: 'p75' | 'p90' | 'median';
  /** Minimum cut duration in ms (hard floor) */
  minCutMs: number;
  /** Whether to include noise regions */
  includeNoise: boolean;
  /** Whether to include filler words */
  includeFillers: boolean;
}

/**
 * Applies harmonic trimming to silence regions: instead of removing entire
 * pauses, trims them to the speaker's natural rhythm length.
 * This preserves the flow and harmony of speech.
 */
function harmonicTrim(
  regions: ClassifiedRegion[],
  rhythm: SpeakerRhythm,
  config: AdaptiveConfig
): ClassifiedRegion[] {
  // Determine the "natural pause" length based on speaker rhythm
  let naturalPauseMs: number;
  switch (config.cutThresholdPercentile) {
    case 'median':
      naturalPauseMs = rhythm.medianWordGapMs;
      break;
    case 'p75':
      naturalPauseMs = rhythm.p75WordGapMs;
      break;
    case 'p90':
      naturalPauseMs = rhythm.p90WordGapMs;
      break;
  }

  // The amount of pause to keep = natural pause * keep ratio
  const keepMs = naturalPauseMs * config.naturalPauseKeepRatio;

  return regions.map((region) => {
    // Only trim silence regions — noise is fully removed
    if (region.type !== 'silence') return region;

    // If the silence is shorter than what we'd keep, skip it entirely
    if (region.durationMs <= keepMs) return null;

    // Trim: keep the first `keepMs` portion as natural pause, cut the rest
    // The kept portion stays at the start (right after the preceding word)
    const trimmedStart = region.startMs + keepMs;
    const trimmedDuration = region.endMs - trimmedStart;

    if (trimmedDuration < config.minCutMs) return null;

    return {
      ...region,
      startMs: trimmedStart,
      durationMs: trimmedDuration,
      label: `${region.label} (trimado ${Math.round(keepMs)}ms mantido)`,
    };
  }).filter((r): r is ClassifiedRegion => r !== null);
}

// ─── Batch Classification ────────────────────────────────────

/**
 * Classifies all candidate zones using adaptive analysis.
 *
 * Key improvements:
 * 1. Uses speaker rhythm for context-aware detection
 * 2. Adaptive thresholds based on local energy vs speech energy
 * 3. Sub-region analysis to find silence within noisy zones
 * 4. Harmonic trimming to preserve natural pauses
 */
export function classifyAllRegions(
  candidateZones: AudioRegion[],
  waveformData: number[],
  samplesPerSecond: number,
  profile: AudioProfile,
  minSilenceDurationMs: number = 400,
  minNoiseDurationMs: number = 300,
  rhythm?: SpeakerRhythm,
  adaptiveConfig?: AdaptiveConfig
): ClassifiedRegion[] {
  // Use default rhythm if not provided (backward compatibility)
  const effectiveRhythm: SpeakerRhythm = rhythm ?? {
    medianWordGapMs: 300,
    p75WordGapMs: 500,
    p90WordGapMs: 800,
    medianSentenceGapMs: 600,
    wordsPerSecond: 2.5,
    avgSpeechEnergyDb: profile.speechLevelDb,
    gapVariability: 200,
  };

  let classified: ClassifiedRegion[] = [];

  for (const zone of candidateZones) {
    // classifyRegion now returns an array (can split zones into sub-regions)
    const subRegions = classifyRegion(waveformData, samplesPerSecond, zone, profile, effectiveRhythm);

    for (const region of subRegions) {
      // Dynamic minimum duration based on rhythm
      // For silence: use the smaller of fixed minimum or rhythm-based minimum
      // This catches short silences that the fixed threshold would miss
      const rhythmBasedMinSilence = effectiveRhythm.medianWordGapMs * 0.5;
      const effectiveMinSilence = Math.min(minSilenceDurationMs, Math.max(100, rhythmBasedMinSilence));

      if (region.type === 'silence' && region.durationMs < effectiveMinSilence) {
        continue;
      }
      if (region.type === 'noise' && region.durationMs < minNoiseDurationMs) {
        continue;
      }

      classified.push(region);
    }
  }

  // Apply harmonic trimming if adaptive config is provided
  if (adaptiveConfig) {
    classified = harmonicTrim(classified, effectiveRhythm, adaptiveConfig);
  }

  return classified.sort((a, b) => a.startMs - b.startMs);
}

// ─── Secondary Waveform Sweep ────────────────────────────────

/**
 * Secondary sample-level waveform sweep that catches silences the
 * transcription-based candidate zone analysis missed.
 *
 * Why this is needed:
 * - Whisper timestamps can be imprecise, causing silence to be "protected"
 * - The adaptive threshold in candidate zones uses RMS which biases high
 * - Padding around speech regions shrinks candidate zones too much
 *
 * This sweep scans the ENTIRE waveform sample-by-sample (like the dB detector),
 * but protects only actual word timestamps (no padding inflation).
 * Any silence found that doesn't overlap with existing classified regions is added.
 */
export function waveformSilenceSweep(
  waveformData: number[],
  samplesPerSecond: number,
  profile: AudioProfile,
  words: { word: string; startMs: number; endMs: number }[],
  existingRegions: ClassifiedRegion[],
  minDurationMs: number = 200
): ClassifiedRegion[] {
  const msPerSample = 1000 / samplesPerSecond;
  const totalMs = waveformData.length * msPerSample;

  // Use the profile's recommended threshold — this is the sweet spot
  // between noise floor and speech level (50% midpoint)
  const thresholdDb = profile.recommendedThresholdDb;

  // Smoothing window (50ms) to avoid false triggers from momentary dips
  const smoothWindow = Math.max(1, Math.round((50 / 1000) * samplesPerSecond));
  const halfWindow = Math.floor(smoothWindow / 2);

  // Scan waveform sample-by-sample
  const silences: { startMs: number; endMs: number; avgDb: number }[] = [];
  let silenceStart: number | null = null;
  let dbSum = 0;
  let dbCount = 0;

  for (let i = 0; i < waveformData.length; i++) {
    // Smoothed amplitude over window
    const winStart = Math.max(0, i - halfWindow);
    const winEnd = Math.min(waveformData.length - 1, i + halfWindow);
    let windowSum = 0;
    let windowCount = 0;
    for (let j = winStart; j <= winEnd; j++) {
      windowSum += waveformData[j];
      windowCount++;
    }
    const smoothedAmp = windowSum / windowCount;
    const db = amplitudeToDb(Math.max(0.00001, smoothedAmp));
    const currentMs = i * msPerSample;

    if (db < thresholdDb) {
      if (silenceStart === null) {
        silenceStart = currentMs;
        dbSum = 0;
        dbCount = 0;
      }
      if (db > -80) {
        dbSum += db;
        dbCount++;
      }
    } else {
      if (silenceStart !== null) {
        const duration = currentMs - silenceStart;
        if (duration >= minDurationMs) {
          const avgDb = dbCount > 0 ? dbSum / dbCount : -60;
          silences.push({ startMs: silenceStart, endMs: currentMs, avgDb });
        }
        silenceStart = null;
      }
    }
  }

  // Handle trailing silence
  if (silenceStart !== null) {
    const duration = totalMs - silenceStart;
    if (duration >= minDurationMs) {
      const avgDb = dbCount > 0 ? dbSum / dbCount : -60;
      silences.push({ startMs: silenceStart, endMs: totalMs, avgDb });
    }
  }

  // Filter: remove any silence that overlaps with actual word timestamps
  // Use tight word boundaries (no padding) — we only protect confirmed speech
  const sortedWords = [...words].sort((a, b) => a.startMs - b.startMs);

  const speechSafe = silences.filter((s) => {
    // Check if any word overlaps with this silence
    for (const w of sortedWords) {
      // Word overlaps if it starts before silence ends AND ends after silence starts
      if (w.startMs < s.endMs && w.endMs > s.startMs) {
        // There's overlap — check how much
        const overlapStart = Math.max(s.startMs, w.startMs);
        const overlapEnd = Math.min(s.endMs, w.endMs);
        const overlapMs = overlapEnd - overlapStart;
        const silenceDuration = s.endMs - s.startMs;

        // If speech covers more than 30% of this silence, it's not silence
        if (overlapMs / silenceDuration > 0.3) return false;
      }

      // Optimization: words are sorted, skip if word starts after silence ends
      if (w.startMs > s.endMs) break;
    }
    return true;
  });

  // Filter: remove silences already covered by existing classified regions
  const newSilences = speechSafe.filter((s) => {
    const sMid = (s.startMs + s.endMs) / 2;
    for (const r of existingRegions) {
      // If the midpoint of this silence is inside an existing region, skip it
      if (sMid >= r.startMs && sMid <= r.endMs) return false;
    }
    return true;
  });

  // Trim edges: apply small padding (50ms) to avoid cutting into speech transitions
  const result: ClassifiedRegion[] = [];
  for (const s of newSilences) {
    const paddedStart = s.startMs + 50;
    const paddedEnd = s.endMs - 50;
    const duration = paddedEnd - paddedStart;
    if (duration < 80) continue;

    result.push({
      startMs: paddedStart,
      endMs: paddedEnd,
      durationMs: duration,
      type: 'silence',
      label: `Silêncio (${s.avgDb.toFixed(1)} dB) [sweep]`,
      avgDb: s.avgDb,
      confidence: 0.8,
    });
  }
  return result;
}

// ─── Filler Word Detection ───────────────────────────────────

const FILLER_WORDS_PT = [
  'é', 'hm', 'hmm', 'um', 'uh', 'ah', 'eh', 'ahn',
  'tipo', 'né', 'então', 'assim', 'enfim', 'bom',
  'ó', 'tá', 'pois',
];

/**
 * Detects filler words from transcription and returns them as ClassifiedRegions.
 * Only includes fillers that don't overlap with already classified silence/noise regions.
 */
export function detectFillerWords(
  words: { word: string; startMs: number; endMs: number }[],
  existingRegions: ClassifiedRegion[]
): ClassifiedRegion[] {
  const fillers: ClassifiedRegion[] = [];

  for (const w of words) {
    const cleaned = w.word.toLowerCase().replace(/[.,!?;:"""''()[\]{}]/g, '').trim();
    if (!FILLER_WORDS_PT.includes(cleaned)) continue;

    // Skip if already covered by a silence/noise region
    const overlaps = existingRegions.some(
      (r) => r.startMs <= w.startMs && r.endMs >= w.endMs
    );
    if (overlaps) continue;

    fillers.push({
      startMs: w.startMs,
      endMs: w.endMs,
      durationMs: w.endMs - w.startMs,
      type: 'filler',
      label: `Filler: "${w.word}"`,
      avgDb: 0,
      confidence: 0.85,
    });
  }

  return fillers;
}

// ─── Merge Regions ───────────────────────────────────────────

/**
 * Merges overlapping or adjacent regions (within toleranceMs).
 * Preserves the type of the larger region when merging.
 */
export function mergeAdjacentRegions(
  regions: ClassifiedRegion[],
  toleranceMs: number = 80
): ClassifiedRegion[] {
  if (regions.length <= 1) return regions;

  const sorted = [...regions].sort((a, b) => a.startMs - b.startMs);
  const merged: ClassifiedRegion[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const curr = sorted[i];

    if (curr.startMs <= last.endMs + toleranceMs && curr.type === last.type) {
      // Merge same-type regions
      last.endMs = Math.max(last.endMs, curr.endMs);
      last.durationMs = last.endMs - last.startMs;
      last.avgDb = (last.avgDb + curr.avgDb) / 2;
      last.confidence = Math.min(last.confidence, curr.confidence);
    } else {
      merged.push({ ...curr });
    }
  }

  return merged;
}
