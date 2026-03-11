'use client';

import { create } from 'zustand';
import type { AspectRatioKey } from '@/lib/constants';

interface EditorStore {
  projectId: string | null;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  volume: number;
  isMuted: boolean;
  zoom: number;
  aspectRatio: AspectRatioKey;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  activeTab: 'media' | 'captions' | 'silence' | 'ai-cut' | 'effects';

  setProjectId: (id: string) => void;
  setIsPlaying: (playing: boolean) => void;
  togglePlayPause: () => void;
  setCurrentTimeMs: (time: number) => void;
  setDurationMs: (duration: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setZoom: (zoom: number) => void;
  setAspectRatio: (ratio: AspectRatioKey) => void;
  setSelectedClipId: (id: string | null) => void;
  setSelectedTrackId: (id: string | null) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  setActiveTab: (tab: 'media' | 'captions' | 'silence' | 'ai-cut' | 'effects') => void;
  reset: () => void;
}

const initialState = {
  projectId: null,
  isPlaying: false,
  currentTimeMs: 0,
  durationMs: 0,
  volume: 1,
  isMuted: false,
  zoom: 1,
  aspectRatio: '16:9' as AspectRatioKey,
  selectedClipId: null,
  selectedTrackId: null,
  leftPanelOpen: true,
  rightPanelOpen: true,
  activeTab: 'media' as const,
};

export const useEditorStore = create<EditorStore>((set) => ({
  ...initialState,

  setProjectId: (id) => set({ projectId: id }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setCurrentTimeMs: (time) => set({ currentTimeMs: time }),
  setDurationMs: (duration) => set({ durationMs: duration }),
  setVolume: (volume) => set({ volume }),
  toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
  setZoom: (zoom) => set({ zoom }),
  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  setSelectedTrackId: (id) => set({ selectedTrackId: id }),
  toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  reset: () => set(initialState),
}));
