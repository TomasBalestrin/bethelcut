'use client';

import { useEditorStore } from '@/stores/useEditorStore';
import { ASPECT_RATIOS, type AspectRatioKey } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function AspectRatioSelector() {
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const setAspectRatio = useEditorStore((s) => s.setAspectRatio);

  const ratioEntries = Object.entries(ASPECT_RATIOS) as [
    AspectRatioKey,
    (typeof ASPECT_RATIOS)[AspectRatioKey],
  ][];

  return (
    <div className="grid grid-cols-3 gap-2">
      {ratioEntries.map(([key, config]) => {
        const w = config.width / Math.max(config.width, config.height);
        const h = config.height / Math.max(config.width, config.height);
        const isActive = aspectRatio === key;

        return (
          <button
            key={key}
            onClick={() => setAspectRatio(key)}
            className={cn(
              'flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-colors',
              isActive
                ? 'border-accent-primary bg-accent-primary/10'
                : 'border-border-default hover:border-border-active bg-bg-surface'
            )}
          >
            <div
              className={cn(
                'rounded border',
                isActive
                  ? 'border-accent-primary bg-accent-primary/20'
                  : 'border-text-muted/30 bg-bg-hover'
              )}
              style={{
                width: `${w * 32}px`,
                height: `${h * 32}px`,
              }}
            />
            <span
              className={cn(
                'text-[10px] font-medium',
                isActive ? 'text-accent-primary' : 'text-text-muted'
              )}
            >
              {key}
            </span>
          </button>
        );
      })}
    </div>
  );
}
