'use client';

import { useCallback, useRef, useState } from 'react';
import type { TimelineTrack, TimelineClip } from '@/types/timeline';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { msToTimelinePixels, timelinePixelsToMs } from '@/lib/utils';

type InteractionMode = 'idle' | 'trimLeft' | 'trimRight' | 'drag';

type HitRegion = 'left-edge' | 'right-edge' | 'body';

interface HitTestResult {
  trackId: string;
  clipId: string;
  clip: TimelineClip;
  region: HitRegion;
}

interface DragState {
  mode: InteractionMode;
  trackId: string;
  clipId: string;
  startMouseX: number;
  startClipStartMs: number;
  startClipEndMs: number;
  startSourceInMs: number;
  startSourceOutMs: number;
  didMove: boolean;
}

const EDGE_THRESHOLD = 6;
const MIN_CLIP_DURATION_MS = 100;
const CLICK_THRESHOLD = 3;
const SNAP_THRESHOLD_MS = 150;

function hitTest(
  mouseX: number,
  mouseY: number,
  tracks: TimelineTrack[],
  effectivePps: number,
  scrollX: number,
  rulerHeight: number
): HitTestResult | null {
  let trackY = rulerHeight;

  for (const track of tracks) {
    const trackBottom = trackY + track.height;

    if (mouseY >= trackY && mouseY < trackBottom) {
      if (track.isLocked) return null;

      for (const clip of track.clips) {
        const clipX = msToTimelinePixels(clip.startTimeMs, effectivePps) - scrollX;
        const clipWidth = msToTimelinePixels(clip.endTimeMs - clip.startTimeMs, effectivePps);

        if (mouseX >= clipX && mouseX <= clipX + clipWidth) {
          let region: HitRegion = 'body';
          if (mouseX - clipX <= EDGE_THRESHOLD) region = 'left-edge';
          else if (clipX + clipWidth - mouseX <= EDGE_THRESHOLD) region = 'right-edge';

          return { trackId: track.id, clipId: clip.id, clip, region };
        }
      }
      return null;
    }
    trackY += track.height;
  }
  return null;
}

function findSnapPoint(
  timeMs: number,
  tracks: TimelineTrack[],
  excludeClipId: string
): number | null {
  let closest: number | null = null;
  let closestDist = SNAP_THRESHOLD_MS;

  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.id === excludeClipId) continue;
      for (const edge of [clip.startTimeMs, clip.endTimeMs]) {
        const dist = Math.abs(timeMs - edge);
        if (dist < closestDist) {
          closestDist = dist;
          closest = edge;
        }
      }
    }
  }

  // Snap to time 0
  if (Math.abs(timeMs) < closestDist) {
    closest = 0;
  }

  return closest;
}

export function useTimelineInteractions(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: {
    tracks: TimelineTrack[];
    effectivePps: number;
    scrollX: number;
    rulerHeight: number;
  }
) {
  const { tracks, effectivePps, scrollX, rulerHeight } = options;

  const updateClip = useTimelineStore((s) => s.updateClip);
  const magnetEnabled = useTimelineStore((s) => s.magnetEnabled);
  const setSelectedClipId = useEditorStore((s) => s.setSelectedClipId);
  const setSelectedTrackId = useEditorStore((s) => s.setSelectedTrackId);
  const setCurrentTimeMs = useEditorStore((s) => s.setCurrentTimeMs);

  const [cursor, setCursor] = useState('default');
  const dragRef = useRef<DragState | null>(null);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [canvasRef]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);
      const hit = hitTest(x, y, tracks, effectivePps, scrollX, rulerHeight);

      if (!hit) return;

      const mode: InteractionMode =
        hit.region === 'left-edge' ? 'trimLeft' :
        hit.region === 'right-edge' ? 'trimRight' : 'drag';

      dragRef.current = {
        mode,
        trackId: hit.trackId,
        clipId: hit.clipId,
        startMouseX: e.clientX,
        startClipStartMs: hit.clip.startTimeMs,
        startClipEndMs: hit.clip.endTimeMs,
        startSourceInMs: hit.clip.sourceInMs,
        startSourceOutMs: hit.clip.sourceOutMs,
        didMove: false,
      };

      e.preventDefault();
    },
    [getCanvasCoords, tracks, effectivePps, scrollX, rulerHeight]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const drag = dragRef.current;

      if (!drag) {
        // Hover: update cursor
        const { x, y } = getCanvasCoords(e);
        const hit = hitTest(x, y, tracks, effectivePps, scrollX, rulerHeight);
        if (!hit) {
          setCursor('default');
        } else if (hit.region === 'left-edge' || hit.region === 'right-edge') {
          setCursor('col-resize');
        } else {
          setCursor('grab');
        }
        return;
      }

      const deltaX = e.clientX - drag.startMouseX;

      if (!drag.didMove && Math.abs(deltaX) > CLICK_THRESHOLD) {
        drag.didMove = true;
        if (drag.mode === 'drag') setCursor('grabbing');
      }

      if (!drag.didMove) return;

      const deltaMs = timelinePixelsToMs(deltaX, effectivePps);

      if (drag.mode === 'trimLeft') {
        let newStartMs = Math.max(0, drag.startClipStartMs + deltaMs);
        newStartMs = Math.min(newStartMs, drag.startClipEndMs - MIN_CLIP_DURATION_MS);

        if (magnetEnabled) {
          const snap = findSnapPoint(newStartMs, tracks, drag.clipId);
          if (snap !== null && snap < drag.startClipEndMs - MIN_CLIP_DURATION_MS) {
            newStartMs = snap;
          }
        }

        const sourceShift = newStartMs - drag.startClipStartMs;
        const newSourceInMs = Math.max(0, drag.startSourceInMs + sourceShift);

        updateClip(drag.trackId, drag.clipId, {
          startTimeMs: newStartMs,
          sourceInMs: newSourceInMs,
        });
      } else if (drag.mode === 'trimRight') {
        let newEndMs = Math.max(drag.startClipStartMs + MIN_CLIP_DURATION_MS, drag.startClipEndMs + deltaMs);

        if (magnetEnabled) {
          const snap = findSnapPoint(newEndMs, tracks, drag.clipId);
          if (snap !== null && snap > drag.startClipStartMs + MIN_CLIP_DURATION_MS) {
            newEndMs = snap;
          }
        }

        const sourceShift = newEndMs - drag.startClipEndMs;
        const newSourceOutMs = drag.startSourceOutMs + sourceShift;

        updateClip(drag.trackId, drag.clipId, {
          endTimeMs: newEndMs,
          sourceOutMs: newSourceOutMs,
        });
      } else if (drag.mode === 'drag') {
        const duration = drag.startClipEndMs - drag.startClipStartMs;
        let newStartMs = Math.max(0, drag.startClipStartMs + deltaMs);

        if (magnetEnabled) {
          const snapStart = findSnapPoint(newStartMs, tracks, drag.clipId);
          const snapEnd = findSnapPoint(newStartMs + duration, tracks, drag.clipId);

          if (snapStart !== null && snapEnd !== null) {
            if (Math.abs(snapStart - newStartMs) <= Math.abs(snapEnd - (newStartMs + duration))) {
              newStartMs = snapStart;
            } else {
              newStartMs = snapEnd - duration;
            }
          } else if (snapStart !== null) {
            newStartMs = snapStart;
          } else if (snapEnd !== null) {
            newStartMs = snapEnd - duration;
          }
        }

        newStartMs = Math.max(0, newStartMs);

        updateClip(drag.trackId, drag.clipId, {
          startTimeMs: newStartMs,
          endTimeMs: newStartMs + duration,
        });
      }
    },
    [getCanvasCoords, tracks, effectivePps, scrollX, rulerHeight, updateClip, magnetEnabled]
  );

  const handleMouseUp = useCallback(
    () => {
      const drag = dragRef.current;
      if (!drag) return;

      if (!drag.didMove) {
        // It was a click, not a drag - select the clip
        setSelectedClipId(drag.clipId);
        setSelectedTrackId(drag.trackId);
      }

      dragRef.current = null;
      setCursor('default');
    },
    [setSelectedClipId, setSelectedTrackId]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // If a drag just ended, skip the click
      if (dragRef.current) return;

      const { x, y } = getCanvasCoords(e);
      const hit = hitTest(x, y, tracks, effectivePps, scrollX, rulerHeight);

      if (!hit) {
        // Clicked empty space: deselect and seek
        setSelectedClipId(null);
        setSelectedTrackId(null);
        const timeMs = Math.max(0, Math.round(((x + scrollX) / effectivePps) * 1000));
        setCurrentTimeMs(timeMs);
      }
    },
    [getCanvasCoords, tracks, effectivePps, scrollX, rulerHeight, setSelectedClipId, setSelectedTrackId, setCurrentTimeMs]
  );

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleClick,
    cursor,
  };
}
