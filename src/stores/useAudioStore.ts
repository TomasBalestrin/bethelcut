'use client';

import { create } from 'zustand';

interface SilenceRegion {
  startMs: number;
  endMs: number;
  type: 'silence' | 'filler';
  confidence: number;
  accepted: boolean;
}

interface AudioStore {
  waveformData: number[];
  isAnalyzing: boolean;
  silenceRegions: SilenceRegion[];
  thresholdDb: number;
  minDurationMs: number;
  paddingMs: number;
  removeFillerWords: boolean;

  setWaveformData: (data: number[]) => void;
  setIsAnalyzing: (analyzing: boolean) => void;
  setSilenceRegions: (regions: SilenceRegion[]) => void;
  toggleSilenceRegion: (index: number) => void;
  setThresholdDb: (db: number) => void;
  setMinDurationMs: (ms: number) => void;
  setPaddingMs: (ms: number) => void;
  setRemoveFillerWords: (remove: boolean) => void;
  acceptAllRegions: () => void;
  rejectAllRegions: () => void;
  reset: () => void;
}

export const useAudioStore = create<AudioStore>((set) => ({
  waveformData: [],
  isAnalyzing: false,
  silenceRegions: [],
  thresholdDb: -35,
  minDurationMs: 500,
  paddingMs: 150,
  removeFillerWords: false,

  setWaveformData: (data) => set({ waveformData: data }),
  setIsAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setSilenceRegions: (regions) => set({ silenceRegions: regions }),
  toggleSilenceRegion: (index) =>
    set((state) => ({
      silenceRegions: state.silenceRegions.map((r, i) =>
        i === index ? { ...r, accepted: !r.accepted } : r
      ),
    })),
  setThresholdDb: (db) => set({ thresholdDb: db }),
  setMinDurationMs: (ms) => set({ minDurationMs: ms }),
  setPaddingMs: (ms) => set({ paddingMs: ms }),
  setRemoveFillerWords: (remove) => set({ removeFillerWords: remove }),
  acceptAllRegions: () =>
    set((state) => ({
      silenceRegions: state.silenceRegions.map((r) => ({
        ...r,
        accepted: true,
      })),
    })),
  rejectAllRegions: () =>
    set((state) => ({
      silenceRegions: state.silenceRegions.map((r) => ({
        ...r,
        accepted: false,
      })),
    })),
  reset: () =>
    set({
      waveformData: [],
      isAnalyzing: false,
      silenceRegions: [],
      thresholdDb: -35,
      minDurationMs: 500,
      paddingMs: 150,
      removeFillerWords: false,
    }),
}));
