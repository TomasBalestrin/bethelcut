'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { THEME } from '@/lib/constants';
import { formatDuration, msToTimelinePixels } from '@/lib/utils';
import { Lock, Eye, EyeOff, Volume2, VolumeX } from 'lucide-react';

const TRACK_LABEL_WIDTH = 140;
const RULER_HEIGHT = 28;

export function Timeline() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const setCurrentTimeMs = useEditorStore((s) => s.setCurrentTimeMs);
  const durationMs = useEditorStore((s) => s.durationMs);
  const zoom = useEditorStore((s) => s.zoom);

  const mediaAssets = useProjectStore((s) => s.mediaAssets);
  const tracks = useTimelineStore((s) => s.tracks);
  const pixelsPerSecond = useTimelineStore((s) => s.pixelsPerSecond);
  const scrollX = useTimelineStore((s) => s.scrollX);
  const setScrollX = useTimelineStore((s) => s.setScrollX);

  const effectivePps = pixelsPerSecond * zoom;
  const totalWidth = Math.max(
    msToTimelinePixels(durationMs || 60000, effectivePps),
    800
  );

  const drawTimeline = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear
    ctx.fillStyle = THEME.bg.timeline;
    ctx.fillRect(0, 0, width, height);

    const offsetX = -scrollX;

    // Draw ruler
    ctx.fillStyle = '#060810';
    ctx.fillRect(0, 0, width, RULER_HEIGHT);
    ctx.strokeStyle = THEME.border.default;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, RULER_HEIGHT);
    ctx.lineTo(width, RULER_HEIGHT);
    ctx.stroke();

    // Time markers
    const stepMs = getTimeStep(effectivePps);
    const startMs = Math.max(0, Math.floor((-offsetX / effectivePps) * 1000 / stepMs) * stepMs);
    const endMs = Math.ceil(((width - offsetX) / effectivePps) * 1000);

    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';

    for (let ms = startMs; ms <= endMs; ms += stepMs) {
      const x = offsetX + msToTimelinePixels(ms, effectivePps);
      if (x < -50 || x > width + 50) continue;

      // Major tick
      ctx.strokeStyle = THEME.border.default;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, RULER_HEIGHT - 8);
      ctx.lineTo(x, RULER_HEIGHT);
      ctx.stroke();

      // Label
      ctx.fillStyle = THEME.text.muted;
      ctx.fillText(formatDuration(ms), x, RULER_HEIGHT - 12);

      // Minor ticks
      const minorStep = stepMs / 4;
      for (let j = 1; j < 4; j++) {
        const mx = offsetX + msToTimelinePixels(ms + j * minorStep, effectivePps);
        if (mx < 0 || mx > width) continue;
        ctx.strokeStyle = 'rgba(24,29,42,0.8)';
        ctx.beginPath();
        ctx.moveTo(mx, RULER_HEIGHT - 4);
        ctx.lineTo(mx, RULER_HEIGHT);
        ctx.stroke();
      }
    }

    // Draw tracks
    let trackY = RULER_HEIGHT;
    for (const track of tracks) {
      const trackHeight = track.height;

      // Track background
      ctx.fillStyle = trackY % 2 === 0 ? '#070a11' : '#0a0d14';
      ctx.fillRect(0, trackY, width, trackHeight);

      // Track bottom border
      ctx.strokeStyle = 'rgba(24,29,42,0.5)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, trackY + trackHeight);
      ctx.lineTo(width, trackY + trackHeight);
      ctx.stroke();

      // Draw clips
      for (const clip of track.clips) {
        const clipX = offsetX + msToTimelinePixels(clip.startTimeMs, effectivePps);
        const clipWidth = msToTimelinePixels(
          clip.endTimeMs - clip.startTimeMs,
          effectivePps
        );

        if (clipX + clipWidth < 0 || clipX > width) continue;

        // Clip colors
        let clipColor: string = THEME.timeline.clip;
        if (clip.clipType === 'audio') clipColor = THEME.timeline.audio;
        if (clip.clipType === 'caption') clipColor = THEME.timeline.caption;
        if (clip.clipType === 'silence_marker') clipColor = THEME.timeline.silence;

        // Clip rect
        ctx.fillStyle = clipColor + '25';
        ctx.strokeStyle = clipColor + '60';
        ctx.lineWidth = 0.5;
        const clipY = trackY + 4;
        const clipH = trackHeight - 8;
        const r = 3;

        ctx.beginPath();
        ctx.moveTo(clipX + r, clipY);
        ctx.lineTo(clipX + clipWidth - r, clipY);
        ctx.quadraticCurveTo(clipX + clipWidth, clipY, clipX + clipWidth, clipY + r);
        ctx.lineTo(clipX + clipWidth, clipY + clipH - r);
        ctx.quadraticCurveTo(clipX + clipWidth, clipY + clipH, clipX + clipWidth - r, clipY + clipH);
        ctx.lineTo(clipX + r, clipY + clipH);
        ctx.quadraticCurveTo(clipX, clipY + clipH, clipX, clipY + clipH - r);
        ctx.lineTo(clipX, clipY + r);
        ctx.quadraticCurveTo(clipX, clipY, clipX + r, clipY);
        ctx.fill();
        ctx.stroke();

        // Clip top accent line
        ctx.fillStyle = clipColor + '80';
        ctx.fillRect(clipX, clipY, clipWidth, 1);

        // Clip label (asset filename)
        if (clipWidth > 40) {
          const asset = clip.assetId
            ? mediaAssets.find((a) => a.id === clip.assetId)
            : null;
          const label = asset?.fileName || clip.clipType;
          ctx.fillStyle = THEME.text.secondary;
          ctx.font = '9px Inter, system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.save();
          ctx.beginPath();
          ctx.rect(clipX + 4, clipY, clipWidth - 8, clipH);
          ctx.clip();
          ctx.fillText(label, clipX + 6, clipY + clipH / 2 + 3);
          ctx.restore();
        }
      }

      trackY += trackHeight;
    }

    // Empty state
    if (tracks.length === 0) {
      const defaultTracks = ['Video', 'Audio', 'Legendas'];
      defaultTracks.forEach((label, i) => {
        const y = RULER_HEIGHT + i * 60;
        ctx.fillStyle = i % 2 === 0 ? '#070a11' : '#0a0d14';
        ctx.fillRect(0, y, width, 60);
        ctx.strokeStyle = 'rgba(24,29,42,0.5)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y + 60);
        ctx.lineTo(width, y + 60);
        ctx.stroke();

        ctx.fillStyle = THEME.text.muted;
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, 10, y + 34);
      });
    }

    // Draw playhead
    const playheadX = offsetX + msToTimelinePixels(currentTimeMs, effectivePps);
    if (playheadX >= 0 && playheadX <= width) {
      // Playhead line
      ctx.strokeStyle = THEME.timeline.playhead;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead triangle
      ctx.fillStyle = THEME.timeline.playhead;
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, 0);
      ctx.lineTo(playheadX + 5, 0);
      ctx.lineTo(playheadX, 8);
      ctx.closePath();
      ctx.fill();
    }
  }, [
    scrollX,
    currentTimeMs,
    tracks,
    effectivePps,
    mediaAssets,
  ]);

  // Animation loop
  useEffect(() => {
    const render = () => {
      drawTimeline();
      animFrameRef.current = requestAnimationFrame(render);
    };
    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [drawTimeline]);

  // Handle click on timeline to seek
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollX;
      const timeMs = Math.max(0, Math.round((x / effectivePps) * 1000));
      setCurrentTimeMs(timeMs);
    },
    [scrollX, effectivePps, setCurrentTimeMs]
  );

  // Handle horizontal scroll
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const newScrollX = Math.max(
          0,
          Math.min(totalWidth - 400, scrollX + (e.deltaX || e.deltaY))
        );
        setScrollX(newScrollX);
      }
    },
    [scrollX, totalWidth, setScrollX]
  );

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      {/* Track Labels + Canvas */}
      <div className="flex-1 flex overflow-hidden">
        {/* Track Labels */}
        <div
          className="flex-shrink-0 border-r border-border-default/60 bg-bg-secondary flex flex-col"
          style={{ width: TRACK_LABEL_WIDTH }}
        >
          {/* Ruler spacer */}
          <div
            className="flex items-center px-2 text-[10px] text-text-muted border-b border-border-default/40"
            style={{ height: RULER_HEIGHT }}
          >
            Faixas
          </div>

          {/* Track labels */}
          {tracks.length > 0 ? (
            tracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between px-2 border-b border-border-default/30"
                style={{ height: track.height }}
              >
                <span className="text-[11px] text-text-muted truncate">
                  {track.label}
                </span>
                <div className="flex items-center gap-0.5">
                  <button className="p-0.5 rounded hover:bg-bg-hover text-text-muted/60 hover:text-text-muted">
                    {track.isMuted ? (
                      <VolumeX size={11} />
                    ) : (
                      <Volume2 size={11} />
                    )}
                  </button>
                  <button className="p-0.5 rounded hover:bg-bg-hover text-text-muted/60 hover:text-text-muted">
                    {track.isHidden ? (
                      <EyeOff size={11} />
                    ) : (
                      <Eye size={11} />
                    )}
                  </button>
                  <button className="p-0.5 rounded hover:bg-bg-hover text-text-muted/60 hover:text-text-muted">
                    <Lock size={11} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <>
              {['Video', 'Audio', 'Legendas'].map((label) => (
                <div
                  key={label}
                  className="flex items-center px-2 border-b border-border-default/30"
                  style={{ height: 60 }}
                >
                  <span className="text-[11px] text-text-muted">{label}</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-hidden">
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-pointer"
            onClick={handleCanvasClick}
            onWheel={handleWheel}
          />
        </div>
      </div>
    </div>
  );
}

function getTimeStep(pps: number): number {
  if (pps > 400) return 500;
  if (pps > 200) return 1000;
  if (pps > 100) return 2000;
  if (pps > 50) return 5000;
  if (pps > 20) return 10000;
  return 30000;
}
