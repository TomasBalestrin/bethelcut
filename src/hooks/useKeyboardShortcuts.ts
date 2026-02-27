'use client';

import { useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';

export function useKeyboardShortcuts() {
  const togglePlayPause = useEditorStore((s) => s.togglePlayPause);
  const setZoom = useEditorStore((s) => s.zoom);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't trigger shortcuts when typing in inputs
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlayPause();
          break;
        case 'b':
        case 'B':
          // Split at playhead
          break;
        case 'Delete':
        case 'Backspace':
          // Delete selected clip
          break;
        case 'z':
          if (isCtrl && e.shiftKey) {
            e.preventDefault();
            // Redo
          } else if (isCtrl) {
            e.preventDefault();
            // Undo
          }
          break;
        case 's':
          if (isCtrl) {
            e.preventDefault();
            // Save
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlayPause, setZoom]);
}
