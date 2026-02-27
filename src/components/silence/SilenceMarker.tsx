'use client';

import { msToTimelinePixels, cn } from '@/lib/utils';

interface SilenceMarkerProps {
  startMs: number;
  endMs: number;
  pixelsPerSecond: number;
  scrollX: number;
  accepted: boolean;
  onClick?: () => void;
}

export function SilenceMarker({
  startMs,
  endMs,
  pixelsPerSecond,
  scrollX,
  accepted,
  onClick,
}: SilenceMarkerProps) {
  const left = msToTimelinePixels(startMs, pixelsPerSecond) - scrollX;
  const width = msToTimelinePixels(endMs - startMs, pixelsPerSecond);

  return (
    <div
      className={cn(
        'absolute top-0 bottom-0 cursor-pointer transition-colors',
        accepted
          ? 'bg-accent-danger/20 border-x border-accent-danger/40'
          : 'bg-accent-warning/10 border-x border-accent-warning/20'
      )}
      style={{ left, width: Math.max(width, 2) }}
      onClick={onClick}
    />
  );
}
