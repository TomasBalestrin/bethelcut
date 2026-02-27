'use client';

import { useCallback, useRef, useState } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { EDITOR_CONFIG } from '@/lib/constants';
import { Toolbar } from './Toolbar';
import { MediaPanel } from './MediaPanel';
import { PreviewPlayer } from './PreviewPlayer';
import { PropertiesPanel } from './PropertiesPanel';
import { Timeline } from './Timeline';
import { clamp } from '@/lib/utils';

export function EditorLayout() {
  const leftPanelOpen = useEditorStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const timelineHeight = useTimelineStore((s) => s.timelineHeight);
  const setTimelineHeight = useTimelineStore((s) => s.setTimelineHeight);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);
  const resizeRef = useRef<{ startY: number; startHeight: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startY: e.clientY, startHeight: timelineHeight };
      setIsResizingTimeline(true);

      const handleMouseMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const delta = resizeRef.current.startY - ev.clientY;
        const newHeight = clamp(
          resizeRef.current.startHeight + delta,
          EDITOR_CONFIG.TIMELINE_MIN_HEIGHT,
          EDITOR_CONFIG.TIMELINE_MAX_HEIGHT
        );
        setTimelineHeight(newHeight);
      };

      const handleMouseUp = () => {
        setIsResizingTimeline(false);
        resizeRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [timelineHeight, setTimelineHeight]
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-bg-primary select-none">
      {/* Toolbar */}
      <Toolbar />

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Media */}
        {leftPanelOpen && (
          <div
            className="border-r border-border-default bg-bg-secondary flex-shrink-0 overflow-y-auto"
            style={{ width: EDITOR_CONFIG.LEFT_PANEL_WIDTH }}
          >
            <MediaPanel />
          </div>
        )}

        {/* Center - Preview Player */}
        <div className="flex-1 min-w-0 flex items-center justify-center bg-bg-primary p-4">
          <PreviewPlayer />
        </div>

        {/* Right Panel - Properties */}
        {rightPanelOpen && (
          <div
            className="border-l border-border-default bg-bg-secondary flex-shrink-0 overflow-y-auto"
            style={{ width: EDITOR_CONFIG.RIGHT_PANEL_WIDTH }}
          >
            <PropertiesPanel />
          </div>
        )}
      </div>

      {/* Timeline Resize Handle */}
      <div
        className={`h-1.5 cursor-row-resize flex items-center justify-center hover:bg-accent-primary/20 transition-colors ${
          isResizingTimeline ? 'bg-accent-primary/30' : 'bg-border-default'
        }`}
        onMouseDown={handleResizeStart}
      >
        <div className="w-12 h-0.5 rounded-full bg-text-muted" />
      </div>

      {/* Timeline */}
      <div
        className="flex-shrink-0 border-t border-border-default bg-bg-timeline overflow-hidden"
        style={{ height: timelineHeight }}
      >
        <Timeline />
      </div>
    </div>
  );
}
