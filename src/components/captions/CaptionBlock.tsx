'use client';

import type { Caption } from '@/types/caption';
import { useCaptionStore } from '@/stores/useCaptionStore';
import { msToTimelinePixels, cn } from '@/lib/utils';

interface CaptionBlockProps {
  caption: Caption;
  pixelsPerSecond: number;
  scrollX: number;
}

export function CaptionBlock({
  caption,
  pixelsPerSecond,
  scrollX,
}: CaptionBlockProps) {
  const selectedCaptionId = useCaptionStore((s) => s.selectedCaptionId);
  const setSelectedCaptionId = useCaptionStore((s) => s.setSelectedCaptionId);

  const left =
    msToTimelinePixels(caption.startTimeMs, pixelsPerSecond) - scrollX;
  const width = msToTimelinePixels(
    caption.endTimeMs - caption.startTimeMs,
    pixelsPerSecond
  );
  const isSelected = selectedCaptionId === caption.id;

  return (
    <div
      className={cn(
        'absolute top-1 bottom-1 rounded bg-timeline-caption/30 border border-timeline-caption cursor-pointer overflow-hidden',
        isSelected && 'ring-2 ring-white/30'
      )}
      style={{ left, width: Math.max(width, 4) }}
      onClick={() => setSelectedCaptionId(caption.id)}
    >
      <div className="h-0.5 w-full bg-timeline-caption" />
      <span className="text-[9px] text-text-primary px-1 truncate block mt-0.5">
        {caption.text}
      </span>
    </div>
  );
}
