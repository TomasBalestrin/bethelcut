'use client';

import { useCaptionStore } from '@/stores/useCaptionStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { formatDuration } from '@/lib/utils';
import { Trash2, Clock } from 'lucide-react';

export function CaptionListEditor() {
  const captions = useCaptionStore((s) => s.captions);
  const updateCaption = useCaptionStore((s) => s.updateCaption);
  const removeCaption = useCaptionStore((s) => s.removeCaption);
  const selectedCaptionId = useCaptionStore((s) => s.selectedCaptionId);
  const setSelectedCaptionId = useCaptionStore((s) => s.setSelectedCaptionId);
  const setCurrentTimeMs = useEditorStore((s) => s.setCurrentTimeMs);

  const sortedCaptions = [...captions].sort(
    (a, b) => a.startTimeMs - b.startTimeMs
  );

  if (sortedCaptions.length === 0) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-text-muted">
          Nenhuma legenda gerada ainda.
        </p>
        <p className="text-xs text-text-muted mt-1">
          Use a transcrição automática para gerar legendas.
        </p>
      </div>
    );
  }

  return (
    <div className="p-2 space-y-1">
      {sortedCaptions.map((caption) => (
        <div
          key={caption.id}
          className={`p-2.5 rounded-lg border cursor-pointer transition-colors ${
            selectedCaptionId === caption.id
              ? 'border-accent-primary bg-accent-primary/5'
              : 'border-transparent hover:bg-bg-surface'
          }`}
          onClick={() => {
            setSelectedCaptionId(caption.id);
            setCurrentTimeMs(caption.startTimeMs);
          }}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Clock size={12} className="text-text-muted" />
            <span className="text-[10px] font-mono text-text-muted">
              {formatDuration(caption.startTimeMs)} -{' '}
              {formatDuration(caption.endTimeMs)}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeCaption(caption.id);
              }}
              className="ml-auto p-0.5 rounded text-text-muted hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
          <textarea
            value={caption.text}
            onChange={(e) =>
              updateCaption(caption.id, { text: e.target.value })
            }
            className="w-full bg-transparent text-sm text-text-primary resize-none border-none focus:ring-0 p-0"
            rows={2}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ))}
    </div>
  );
}
