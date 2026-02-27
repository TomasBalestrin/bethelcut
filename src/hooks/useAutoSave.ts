'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { createClient } from '@/lib/supabase/client';
import { EDITOR_CONFIG } from '@/lib/constants';

export function useAutoSave() {
  const currentProject = useProjectStore((s) => s.currentProject);
  const setIsSaving = useProjectStore((s) => s.setIsSaving);
  const setLastSavedAt = useProjectStore((s) => s.setLastSavedAt);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);
  const tracks = useTimelineStore((s) => s.tracks);
  const supabase = createClient();
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!currentProject) return;

    const save = async () => {
      setIsSaving(true);
      try {
        await supabase
          .from('projects')
          .update({
            aspect_ratio: aspectRatio,
            editor_state: {
              tracks,
              savedAt: new Date().toISOString(),
            },
          })
          .eq('id', currentProject.id);

        setLastSavedAt(new Date().toISOString());
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        setIsSaving(false);
      }
    };

    timeoutRef.current = setInterval(
      save,
      EDITOR_CONFIG.AUTOSAVE_INTERVAL_MS
    );

    return () => {
      if (timeoutRef.current) clearInterval(timeoutRef.current);
    };
  }, [
    currentProject,
    aspectRatio,
    tracks,
    supabase,
    setIsSaving,
    setLastSavedAt,
  ]);
}
