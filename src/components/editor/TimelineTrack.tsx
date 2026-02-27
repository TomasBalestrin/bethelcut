'use client';

import type { TimelineTrack as TrackType } from '@/types/timeline';
import { TimelineClip } from './TimelineClip';

interface TimelineTrackProps {
  track: TrackType;
  pixelsPerSecond: number;
  scrollX: number;
}

export function TimelineTrack({ track, pixelsPerSecond, scrollX }: TimelineTrackProps) {
  return (
    <div
      className="relative border-b border-border-default/30"
      style={{ height: track.height }}
    >
      {track.clips.map((clip) => (
        <TimelineClip
          key={clip.id}
          clip={clip}
          pixelsPerSecond={pixelsPerSecond}
          scrollX={scrollX}
        />
      ))}
    </div>
  );
}
