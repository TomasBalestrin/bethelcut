'use client';

import { useCaptionStore } from '@/stores/useCaptionStore';
import { useEditorStore } from '@/stores/useEditorStore';
import type { Caption } from '@/types/caption';

export function CaptionPreview() {
  const captions = useCaptionStore((s) => s.captions);
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);

  const activeCaption = captions.find(
    (c) => currentTimeMs >= c.startTimeMs && currentTimeMs <= c.endTimeMs
  );

  if (!activeCaption) return null;

  return <CaptionOverlay caption={activeCaption} />;
}

function CaptionOverlay({ caption }: { caption: Caption }) {
  const { style } = caption;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${caption.positionXPct}%`,
        top: `${caption.positionYPct}%`,
        transform: 'translate(-50%, -50%)',
        maxWidth: `${caption.maxWidthPct}%`,
      }}
    >
      <span
        style={{
          fontFamily: style.fontFamily,
          fontSize: `${style.fontSize}${style.fontSizeUnit}`,
          fontWeight: style.fontWeight,
          color: style.color,
          backgroundColor: style.backgroundColor,
          padding: `${style.backgroundPadding}px`,
          borderRadius: `${style.borderRadius}px`,
          textAlign: style.textAlign,
          WebkitTextStroke:
            style.strokeWidth > 0
              ? `${style.strokeWidth}px ${style.strokeColor}`
              : undefined,
          textShadow:
            style.shadowBlur > 0
              ? `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`
              : undefined,
          display: 'inline-block',
          lineHeight: 1.4,
        }}
      >
        {caption.text}
      </span>
    </div>
  );
}
