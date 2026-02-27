'use client';

import { create } from 'zustand';
import type { TimelineTrack, TimelineClip } from '@/types/timeline';

interface TimelineStore {
  tracks: TimelineTrack[];
  pixelsPerSecond: number;
  scrollX: number;
  scrollY: number;
  snapEnabled: boolean;
  magnetEnabled: boolean;
  timelineHeight: number;

  setTracks: (tracks: TimelineTrack[]) => void;
  addTrack: (track: TimelineTrack) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  addClip: (trackId: string, clip: TimelineClip) => void;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
  setPixelsPerSecond: (pps: number) => void;
  setScrollX: (x: number) => void;
  setScrollY: (y: number) => void;
  toggleSnap: () => void;
  toggleMagnet: () => void;
  setTimelineHeight: (height: number) => void;
  reset: () => void;
}

const initialState = {
  tracks: [],
  pixelsPerSecond: 100,
  scrollX: 0,
  scrollY: 0,
  snapEnabled: true,
  magnetEnabled: true,
  timelineHeight: 250,
};

export const useTimelineStore = create<TimelineStore>((set) => ({
  ...initialState,

  setTracks: (tracks) => set({ tracks }),
  addTrack: (track) => set((state) => ({ tracks: [...state.tracks, track] })),
  removeTrack: (trackId) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
    })),
  updateTrack: (trackId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, ...updates } : t
      ),
    })),
  addClip: (trackId, clip) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t
      ),
    })),
  removeClip: (trackId, clipId) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? { ...t, clips: t.clips.filter((c) => c.id !== clipId) }
          : t
      ),
    })),
  updateClip: (trackId, clipId, updates) =>
    set((state) => ({
      tracks: state.tracks.map((t) =>
        t.id === trackId
          ? {
              ...t,
              clips: t.clips.map((c) =>
                c.id === clipId ? { ...c, ...updates } : c
              ),
            }
          : t
      ),
    })),
  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  setScrollX: (x) => set({ scrollX: x }),
  setScrollY: (y) => set({ scrollY: y }),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  toggleMagnet: () => set((state) => ({ magnetEnabled: !state.magnetEnabled })),
  setTimelineHeight: (height) => set({ timelineHeight: height }),
  reset: () => set(initialState),
}));
