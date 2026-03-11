'use client';

import { create } from 'zustand';
import type { TranscriptionWord, TranscriptionSegment } from '@/types/caption';

// Filler words in Portuguese
const FILLER_WORDS_PT = ['é', 'hm', 'hmm', 'um', 'uh', 'ah', 'eh', 'tipo', 'né', 'então', 'assim', 'enfim', 'bom', 'bem', 'olha', 'veja'];

interface TranscriptionStore {
  transcriptionId: string | null;
  fullText: string;
  words: TranscriptionWord[];
  segments: TranscriptionSegment[];
  isTranscribing: boolean;
  error: string | null;

  // Selection for text-based editing
  selectedWordIndices: Set<number>;
  fillerWordIndices: number[];
  pauseRegions: { startMs: number; endMs: number; afterWordIndex: number }[];

  // Settings
  minPauseDurationMs: number;
  gapPaddingMs: number;

  setTranscription: (data: {
    id: string;
    fullText: string;
    words: TranscriptionWord[];
    segments: TranscriptionSegment[];
  }) => void;
  setIsTranscribing: (v: boolean) => void;
  setError: (error: string | null) => void;
  toggleWordSelection: (index: number) => void;
  selectWordRange: (from: number, to: number) => void;
  clearSelection: () => void;
  selectAllFillerWords: () => void;
  selectAllPauses: () => void;
  setMinPauseDurationMs: (ms: number) => void;
  setGapPaddingMs: (ms: number) => void;
  getSelectedRegions: () => { startMs: number; endMs: number }[];
  getPauseRegionsWithPadding: () => { startMs: number; endMs: number }[];
  reset: () => void;
}

function detectFillerWords(words: TranscriptionWord[]): number[] {
  return words
    .map((w, i) => ({ word: w.word.toLowerCase().replace(/[.,!?;:]/g, ''), index: i }))
    .filter((w) => FILLER_WORDS_PT.includes(w.word))
    .map((w) => w.index);
}

function detectPauses(
  words: TranscriptionWord[],
  minDurationMs: number
): { startMs: number; endMs: number; afterWordIndex: number }[] {
  const pauses: { startMs: number; endMs: number; afterWordIndex: number }[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].startMs - words[i].endMs;
    if (gap >= minDurationMs) {
      pauses.push({
        startMs: words[i].endMs,
        endMs: words[i + 1].startMs,
        afterWordIndex: i,
      });
    }
  }
  return pauses;
}

export const useTranscriptionStore = create<TranscriptionStore>((set, get) => ({
  transcriptionId: null,
  fullText: '',
  words: [],
  segments: [],
  isTranscribing: false,
  error: null,
  selectedWordIndices: new Set<number>(),
  fillerWordIndices: [],
  pauseRegions: [],
  minPauseDurationMs: 500,
  gapPaddingMs: 80,

  setTranscription: (data) =>
    set({
      transcriptionId: data.id,
      fullText: data.fullText,
      words: data.words,
      segments: data.segments,
      error: null,
      selectedWordIndices: new Set(),
      fillerWordIndices: detectFillerWords(data.words),
      pauseRegions: detectPauses(data.words, get().minPauseDurationMs),
    }),

  setIsTranscribing: (v) => set({ isTranscribing: v }),
  setError: (error) => set({ error }),

  toggleWordSelection: (index) =>
    set((state) => {
      const next = new Set(state.selectedWordIndices);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return { selectedWordIndices: next };
    }),

  selectWordRange: (from, to) =>
    set(() => {
      const next = new Set<number>();
      const lo = Math.min(from, to);
      const hi = Math.max(from, to);
      for (let i = lo; i <= hi; i++) next.add(i);
      return { selectedWordIndices: next };
    }),

  clearSelection: () => set({ selectedWordIndices: new Set() }),

  selectAllFillerWords: () =>
    set((state) => ({
      selectedWordIndices: new Set(state.fillerWordIndices),
    })),

  selectAllPauses: () => set({ selectedWordIndices: new Set() }),

  setMinPauseDurationMs: (ms) =>
    set((state) => ({
      minPauseDurationMs: ms,
      pauseRegions: detectPauses(state.words, ms),
    })),

  setGapPaddingMs: (ms) => set({ gapPaddingMs: ms }),

  getPauseRegionsWithPadding: () => {
    const { pauseRegions, gapPaddingMs } = get();
    return pauseRegions
      .map((p) => ({
        startMs: Math.max(0, p.startMs + gapPaddingMs),
        endMs: Math.max(p.startMs + gapPaddingMs, p.endMs - gapPaddingMs),
      }))
      .filter((r) => r.endMs - r.startMs > 20);
  },

  getSelectedRegions: () => {
    const { words, selectedWordIndices } = get();
    if (selectedWordIndices.size === 0) return [];

    // Group consecutive selected words into regions
    const sorted = Array.from(selectedWordIndices).sort((a, b) => a - b);
    const regions: { startMs: number; endMs: number }[] = [];
    let regionStart = words[sorted[0]]?.startMs;
    let regionEnd = words[sorted[0]]?.endMs;

    for (let i = 1; i < sorted.length; i++) {
      const idx = sorted[i];
      const prevIdx = sorted[i - 1];
      // Consecutive words or very close together
      if (idx === prevIdx + 1) {
        regionEnd = words[idx].endMs;
      } else {
        regions.push({ startMs: regionStart, endMs: regionEnd });
        regionStart = words[idx].startMs;
        regionEnd = words[idx].endMs;
      }
    }
    regions.push({ startMs: regionStart, endMs: regionEnd });

    return regions;
  },

  reset: () =>
    set({
      transcriptionId: null,
      fullText: '',
      words: [],
      segments: [],
      isTranscribing: false,
      error: null,
      selectedWordIndices: new Set(),
      fillerWordIndices: [],
      pauseRegions: [],
    }),
}));
