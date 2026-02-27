'use client';

import type { TimelineClip as ClipType } from '@/types/timeline';
import { useEditorStore } from '@/stores/useEditorStore';
import { msToTimelinePixels } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface TimelineClipProps {
  clip: ClipType;
  pixelsPerSecond: number;
  scrollX: number;
}

export function TimelineClip({ clip, pixelsPerSecond, scrollX }: TimelineClipProps) {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const setSelectedClipId = useEditorStore((s) => s.setSelectedClipId);

  const left = msToTimelinePixels(clip.startTimeMs, pixelsPerSecond) - scrollX;
  const width = msToTimelinePixels(clip.endTimeMs - clip.startTimeMs, pixelsPerSecond);
  const isSelected = selectedClipId === clip.id;

  const colorMap: Record<string, string> = {
    video: 'bg-timeline-clip/40 border-timeline-clip',
    audio: 'bg-timeline-audio/40 border-timeline-audio',
    caption: 'bg-timeline-caption/40 border-timeline-caption',
    effect: 'bg-accent-secondary/40 border-accent-secondary',
    silence_marker: 'bg-timeline-silence border-accent-danger',
  };

  return (
    <div
      className={cn(
        'absolute top-1 bottom-1 rounded border cursor-pointer transition-shadow',
        colorMap[clip.clipType] || colorMap.video,
        isSelected && 'ring-2 ring-white/30 shadow-lg'
      )}
      style={{ left, width: Math.max(width, 4) }}
      onClick={() => setSelectedClipId(clip.id)}
    />
  );
}
