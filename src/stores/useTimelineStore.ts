'use client';

import { create } from 'zustand';
import type { TimelineTrack, TimelineClip } from '@/types/timeline';

const MAX_HISTORY = 50;

interface TimelineStore {
  tracks: TimelineTrack[];
  pixelsPerSecond: number;
  scrollX: number;
  scrollY: number;
  snapEnabled: boolean;
  magnetEnabled: boolean;
  timelineHeight: number;

  // Undo/Redo history
  _history: TimelineTrack[][];
  _future: TimelineTrack[][];

  setTracks: (tracks: TimelineTrack[]) => void;
  addTrack: (track: TimelineTrack) => void;
  removeTrack: (trackId: string) => void;
  updateTrack: (trackId: string, updates: Partial<TimelineTrack>) => void;
  addClip: (trackId: string, clip: TimelineClip) => void;
  removeClip: (trackId: string, clipId: string) => void;
  updateClip: (trackId: string, clipId: string, updates: Partial<TimelineClip>) => void;
  splitClipAtPlayhead: (playheadMs: number) => void;
  removeSilenceRegions: (regions: { startMs: number; endMs: number }[]) => void;
  findClipById: (clipId: string) => { track: TimelineTrack; clip: TimelineClip } | null;
  removeClipById: (clipId: string) => void;
  setPixelsPerSecond: (pps: number) => void;
  setScrollX: (x: number) => void;
  setScrollY: (y: number) => void;
  toggleSnap: () => void;
  toggleMagnet: () => void;
  setTimelineHeight: (height: number) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
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
  _history: [] as TimelineTrack[][],
  _future: [] as TimelineTrack[][],
};

// Helper: deep clone tracks for history snapshots
function cloneTracks(tracks: TimelineTrack[]): TimelineTrack[] {
  return tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, properties: { ...c.properties } })) }));
}

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
    set((state) => {
      const snapshot = cloneTracks(state.tracks);
      const newTracks = state.tracks.map((track) => {
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
      });

      // Only push history if tracks actually changed
      const changed = newTracks !== state.tracks;
      return {
        tracks: newTracks,
        _history: changed
          ? [...state._history.slice(-(MAX_HISTORY - 1)), snapshot]
          : state._history,
        _future: changed ? [] : state._future,
      };
    }),

  removeSilenceRegions: (regions) =>
    set((state) => {
      if (regions.length === 0) return state;
      const snapshot = cloneTracks(state.tracks);

      // Sort regions by startMs ascending
      const sorted = [...regions].sort((a, b) => a.startMs - b.startMs);

      const newTracks = state.tracks.map((track) => {
        if (track.type !== 'video' && track.type !== 'audio') return track;

        let currentClips = [...track.clips];

        // For each silence region, split clips that overlap and remove the silent part
        for (const region of sorted) {
          const resultClips: TimelineClip[] = [];

          for (const clip of currentClips) {
            // No overlap - keep clip as is
            if (clip.endTimeMs <= region.startMs || clip.startTimeMs >= region.endMs) {
              resultClips.push(clip);
              continue;
            }

            const clipDuration = clip.endTimeMs - clip.startTimeMs;
            const sourceDuration = clip.sourceOutMs - clip.sourceInMs;

            // Part before silence
            if (clip.startTimeMs < region.startMs) {
              const ratio = (region.startMs - clip.startTimeMs) / clipDuration;
              resultClips.push({
                ...clip,
                endTimeMs: region.startMs,
                sourceOutMs: clip.sourceInMs + sourceDuration * ratio,
              });
            }

            // Part after silence
            if (clip.endTimeMs > region.endMs) {
              const ratioStart = (region.endMs - clip.startTimeMs) / clipDuration;
              resultClips.push({
                ...clip,
                id: crypto.randomUUID(),
                startTimeMs: region.endMs,
                sourceInMs: clip.sourceInMs + sourceDuration * ratioStart,
              });
            }

            // If clip is entirely within silence, it's dropped
          }

          currentClips = resultClips;
        }

        // Now close gaps: shift clips left to remove empty spaces
        const sortedClips = currentClips.sort((a, b) => a.startTimeMs - b.startTimeMs);
        let nextStart = 0;
        const compactedClips: TimelineClip[] = [];

        for (const clip of sortedClips) {
          const duration = clip.endTimeMs - clip.startTimeMs;
          compactedClips.push({
            ...clip,
            startTimeMs: nextStart,
            endTimeMs: nextStart + duration,
            orderIndex: compactedClips.length,
          });
          nextStart += duration;
        }

        return { ...track, clips: compactedClips };
      });

      return {
        tracks: newTracks,
        _history: [...state._history.slice(-(MAX_HISTORY - 1)), snapshot],
        _future: [],
      };
    }),

  findClipById: (clipId) => {
    const state = get();
    for (const track of state.tracks) {
      const clip = track.clips.find((c) => c.id === clipId);
      if (clip) return { track, clip };
    }
    return null;
  },

  removeClipById: (clipId) =>
    set((state) => {
      const snapshot = cloneTracks(state.tracks);
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }));
      const hadClip = state.tracks.some((t) => t.clips.some((c) => c.id === clipId));
      return {
        tracks: newTracks,
        _history: hadClip
          ? [...state._history.slice(-(MAX_HISTORY - 1)), snapshot]
          : state._history,
        _future: hadClip ? [] : state._future,
      };
    }),

  undo: () =>
    set((state) => {
      if (state._history.length === 0) return state;
      const previous = state._history[state._history.length - 1];
      return {
        tracks: previous,
        _history: state._history.slice(0, -1),
        _future: [cloneTracks(state.tracks), ...state._future].slice(0, MAX_HISTORY),
      };
    }),

  redo: () =>
    set((state) => {
      if (state._future.length === 0) return state;
      const next = state._future[0];
      return {
        tracks: next,
        _history: [...state._history, cloneTracks(state.tracks)].slice(-MAX_HISTORY),
        _future: state._future.slice(1),
      };
    }),

  canUndo: () => get()._history.length > 0,
  canRedo: () => get()._future.length > 0,

  setPixelsPerSecond: (pps) => set({ pixelsPerSecond: pps }),
  setScrollX: (x) => set({ scrollX: x }),
  setScrollY: (y) => set({ scrollY: y }),
  toggleSnap: () => set((state) => ({ snapEnabled: !state.snapEnabled })),
  toggleMagnet: () => set((state) => ({ magnetEnabled: !state.magnetEnabled })),
  setTimelineHeight: (height) => set({ timelineHeight: height }),
  reset: () => set(initialState),
}));
