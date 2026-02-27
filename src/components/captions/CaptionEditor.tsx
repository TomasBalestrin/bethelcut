'use client';

import { useCaptionStore } from '@/stores/useCaptionStore';
import { CaptionListEditor } from './CaptionListEditor';
import { CaptionStylePanel } from './CaptionStylePanel';

export function CaptionEditor() {
  const editMode = useCaptionStore((s) => s.editMode);
  const setEditMode = useCaptionStore((s) => s.setEditMode);
  const captions = useCaptionStore((s) => s.captions);

  return (
    <div className="flex flex-col h-full">
      {/* Mode Toggle */}
      <div className="flex border-b border-border-default">
        <button
          onClick={() => setEditMode('timeline')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            editMode === 'timeline'
              ? 'text-accent-primary border-b-2 border-accent-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setEditMode('list')}
          className={`flex-1 py-2 text-xs font-medium transition-colors ${
            editMode === 'list'
              ? 'text-accent-primary border-b-2 border-accent-primary'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Lista ({captions.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {editMode === 'list' ? <CaptionListEditor /> : <CaptionStylePanel />}
      </div>
    </div>
  );
}
