'use client';

import { useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTimelineStore } from '@/stores/useTimelineStore';

export function useKeyboardShortcuts() {
  const togglePlayPause = useEditorStore((s) => s.togglePlayPause);
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const setSelectedClipId = useEditorStore((s) => s.setSelectedClipId);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);

  const splitClipAtPlayhead = useTimelineStore((s) => s.splitClipAtPlayhead);
  const removeClipById = useTimelineStore((s) => s.removeClipById);

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
          e.preventDefault();
          splitClipAtPlayhead(currentTimeMs);
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (selectedClipId) {
            removeClipById(selectedClipId);
            setSelectedClipId(null);
          }
          break;
        case 'z':
          if (isCtrl && e.shiftKey) {
            e.preventDefault();
            // Redo - future implementation
          } else if (isCtrl) {
            e.preventDefault();
            // Undo - future implementation
          }
          break;
        case 's':
          if (isCtrl) {
            e.preventDefault();
            // Save - future implementation
          }
          break;
        case '=':
        case '+':
          if (isCtrl) {
            e.preventDefault();
            setZoom(Math.min(4, zoom + 0.25));
          }
          break;
        case '-':
          if (isCtrl) {
            e.preventDefault();
            setZoom(Math.max(0.25, zoom - 0.25));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlayPause,
    currentTimeMs,
    selectedClipId,
    setSelectedClipId,
    splitClipAtPlayhead,
    removeClipById,
    zoom,
    setZoom,
  ]);
}
