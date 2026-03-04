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
  splitClipAtPlayhead: (playheadMs: number) => void;
  findClipById: (clipId: string) => { track: TimelineTrack; clip: TimelineClip } | null;
  removeClipById: (clipId: string) => void;
  setPixelsPerSecond: (pps: number) => void;
  setScrollX: (x: number) => void;
  setScrollY: (y: number) => void;
  toggleSnap: () => void;
  toggleMagnet: () => void;
  setTimelineHeight: (height: number) => void;
  reset: () => void;
}

const initialState = {
  tracks: [] as TimelineTrack[],
  pixelsPerSecond: 100,
  scrollX: 0,
  scrollY: 0,
  snapEnabled: true,
  magnetEnabled: true,
  timelineHeight: 250,
};

export const useTimelineStore = create<TimelineStore>((set, get) => ({
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

  splitClipAtPlayhead: (playheadMs) =>
    set((state) => ({
      tracks: state.tracks.map((track) => {
        const clipIndex = track.clips.findIndex(
          (c) => c.startTimeMs < playheadMs && c.endTimeMs > playheadMs
        );
        if (clipIndex === -1) return track;

        const clip = track.clips[clipIndex];
        const duration = clip.endTimeMs - clip.startTimeMs;
        const sourceDuration = clip.sourceOutMs - clip.sourceInMs;
        const splitRatio = (playheadMs - clip.startTimeMs) / duration;

        const clip1: TimelineClip = {
          ...clip,
          endTimeMs: playheadMs,
          sourceOutMs: clip.sourceInMs + sourceDuration * splitRatio,
        };
        const clip2: TimelineClip = {
          ...clip,
          id: crypto.randomUUID(),
          startTimeMs: playheadMs,
          sourceInMs: clip.sourceInMs + sourceDuration * splitRatio,
          orderIndex: clip.orderIndex + 1,
        };

        const newClips = [...track.clips];
        newClips.splice(clipIndex, 1, clip1, clip2);
        return { ...track, clips: newClips };
      }),
    })),

  findClipById: (clipId) => {
    const state = get();
    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) return { track, clip };
    }
    return null;
  },

  removeClipById: (clipId) =>
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      })),
    })),

  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  setScrollX: (x) => set({ scrollX: x }),
  setScrollY: (y) => set({ scrollY: y }),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  toggleMagnet: () => set((state) => ({ magnetEnabled: !state.magnetEnabled })),
  setTimelineHeight: (height) => set({ timelineHeight: height }),
  reset: () => set(initialState),
}));
