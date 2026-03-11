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

// ─── Region Classification ───────────────────────────────────

/**
 * Classifies a single non-speech region as silence, noise, or ambient.
 *
 * Classification logic:
 * - SILENCE: avgDb below noise floor + margin (6dB)
 * - NOISE types (above silence threshold):
 *   - Continuous (motor, fan, AC): low stdDev, low crest factor
 *   - Impulsive (bark, slam, honk): high stdDev, high crest factor
 *   - Ambient (traffic, crowd): intermediate characteristics
 */
function classifyRegion(
  waveformData: number[],
  samplesPerSecond: number,
  region: AudioRegion,
  profile: AudioProfile
): ClassifiedRegion {
  const metrics = calculateRegionMetrics(waveformData, samplesPerSecond, region);
  const durationMs = region.endMs - region.startMs;

  // Silence threshold: noise floor + 6dB margin
  const silenceThresholdDb = profile.noiseFloorDb + 6;

  if (metrics.avgDb < silenceThresholdDb) {
    return {
      startMs: region.startMs,
      endMs: region.endMs,
      durationMs,
      type: 'silence',
      label: `Silêncio (${metrics.avgDb.toFixed(1)} dB)`,
      avgDb: metrics.avgDb,
      confidence: 0.95,
    };
  }

  // It's noise — classify the type
  // Normalize metrics relative to the audio profile for consistent classification
  const dbAboveFloor = metrics.avgDb - profile.noiseFloorDb;
  const dbRange = profile.speechLevelDb - profile.noiseFloorDb;
  const relativeLevel = dbRange > 0 ? dbAboveFloor / dbRange : 0.5;

  // Classification thresholds (empirically tuned)
  const isImpulsive = metrics.crestFactor > 4 && metrics.stdDev > 0.05;
  const isContinuous = metrics.crestFactor < 2.5 && metrics.stdDev < 0.03;

  let noiseType: 'continuous' | 'impulsive' | 'ambient';
  let noiseLabel: string;
  let confidence: number;

  if (isImpulsive) {
    noiseType = 'impulsive';
    if (metrics.zeroCrossingRate > 200) {
      noiseLabel = `Ruído impulsivo agudo (${metrics.avgDb.toFixed(1)} dB)`;
    } else {
      noiseLabel = `Ruído impulsivo (${metrics.avgDb.toFixed(1)} dB)`;
    }
    confidence = Math.min(0.95, 0.7 + relativeLevel * 0.25);
  } else if (isContinuous) {
    noiseType = 'continuous';
    if (metrics.zeroCrossingRate < 50) {
      noiseLabel = `Ruído contínuo grave (${metrics.avgDb.toFixed(1)} dB)`;
    } else {
      noiseLabel = `Ruído contínuo (${metrics.avgDb.toFixed(1)} dB)`;
    }
    confidence = Math.min(0.9, 0.65 + relativeLevel * 0.25);
  } else {
    noiseType = 'ambient';
    noiseLabel = `Ruído ambiente (${metrics.avgDb.toFixed(1)} dB)`;
    confidence = Math.min(0.85, 0.6 + relativeLevel * 0.2);
  }

  return {
    startMs: region.startMs,
    endMs: region.endMs,
    durationMs,
    type: 'noise',
    noiseType,
    label: noiseLabel,
    avgDb: metrics.avgDb,
    confidence,
  };
}

// ─── Batch Classification ────────────────────────────────────

/**
 * Classifies all candidate zones (non-speech regions) in batch.
 * Filters by minimum duration based on type.
 */
export function classifyAllRegions(
  candidateZones: AudioRegion[],
  waveformData: number[],
  samplesPerSecond: number,
  profile: AudioProfile,
  minSilenceDurationMs: number = 400,
  minNoiseDurationMs: number = 300
): ClassifiedRegion[] {
  const classified: ClassifiedRegion[] = [];

  for (const zone of candidateZones) {
    const region = classifyRegion(waveformData, samplesPerSecond, zone, profile);

    // Apply minimum duration filter per type
    if (region.type === 'silence' && region.durationMs < minSilenceDurationMs) {
      continue;
    }
    if (region.type === 'noise' && region.durationMs < minNoiseDurationMs) {
      continue;
    }

    classified.push(region);
  }

  return classified.sort((a, b) => a.startMs - b.startMs);
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
