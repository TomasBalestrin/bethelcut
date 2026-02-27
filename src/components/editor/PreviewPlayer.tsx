'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { createClient } from '@/lib/supabase/client';
import { ASPECT_RATIOS } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';

export function PreviewPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const setCurrentTimeMs = useEditorStore((s) => s.setCurrentTimeMs);
  const durationMs = useEditorStore((s) => s.durationMs);
  const setDurationMs = useEditorStore((s) => s.setDurationMs);
  const volume = useEditorStore((s) => s.volume);
  const setVolume = useEditorStore((s) => s.setVolume);
  const isMuted = useEditorStore((s) => s.isMuted);
  const toggleMute = useEditorStore((s) => s.toggleMute);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);

  const mediaAssets = useProjectStore((s) => s.mediaAssets);
  const currentProject = useProjectStore((s) => s.currentProject);

  const tracks = useTimelineStore((s) => s.tracks);
  const updateClip = useTimelineStore((s) => s.updateClip);

  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const supabase = createClient();

  // Find video asset: try from timeline clip first, then fall back to direct asset
  const videoTrack = tracks.find((t) => t.type === 'video');
  const firstVideoClip = videoTrack?.clips[0];
  const clipAsset = firstVideoClip?.assetId
    ? mediaAssets.find((a) => a.id === firstVideoClip.assetId)
    : null;
  const directAsset = mediaAssets.find((a) => a.type === 'video');
  const videoAsset = clipAsset || directAsset;

  const ratioConfig = ASPECT_RATIOS[aspectRatio];
  const aspectRatioValue = ratioConfig.width / ratioConfig.height;

  // Reset video states when asset changes
  useEffect(() => {
    setVideoReady(false);
    setVideoError(false);
  }, [videoAsset?.id]);

  // Play/Pause sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, setIsPlaying]);

  // Volume sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Bidirectional sync: when currentTimeMs changes externally (timeline click), seek video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const videoTimeMs = Math.round(video.currentTime * 1000);
    // Only seek if the difference is significant (= external change, not from timeupdate)
    if (Math.abs(currentTimeMs - videoTimeMs) > 250) {
      const targetSec = currentTimeMs / 1000;
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.max(0, Math.min(video.duration, targetSec));
      } else {
        video.currentTime = Math.max(0, targetSec);
      }
    }
  }, [currentTimeMs]);

  // Video drives currentTimeMs while playing
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTimeMs(Math.round(video.currentTime * 1000));
  }, [setCurrentTimeMs]);

  // When video data is loaded enough to display a frame
  const handleCanPlay = useCallback(() => {
    setVideoReady(true);
  }, []);

  // When video metadata loads, fix duration and clip if needed
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const realDurationMs = Math.round(video.duration * 1000);
    if (realDurationMs <= 0 || !Number.isFinite(realDurationMs)) return;

    // Update project duration
    setDurationMs(realDurationMs);

    // Fix clip duration if it was created with a default (30s)
    if (firstVideoClip && videoTrack) {
      const clipDuration = firstVideoClip.endTimeMs - firstVideoClip.startTimeMs;
      if (Math.abs(clipDuration - realDurationMs) > 500) {
        const newEndTime = firstVideoClip.startTimeMs + realDurationMs;

        // Update clip in store
        updateClip(videoTrack.id, firstVideoClip.id, {
          endTimeMs: newEndTime,
          sourceOutMs: realDurationMs,
        });

        // Persist to DB
        supabase
          .from('timeline_clips')
          .update({
            end_time_ms: newEndTime,
            source_out_ms: realDurationMs,
          })
          .eq('id', firstVideoClip.id);

        if (firstVideoClip.assetId) {
          supabase
            .from('media_assets')
            .update({ duration_ms: realDurationMs })
            .eq('id', firstVideoClip.assetId);
        }

        if (currentProject) {
          supabase
            .from('projects')
            .update({ duration_ms: newEndTime })
            .eq('id', currentProject.id);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDurationMs, firstVideoClip?.id, videoTrack?.id, currentProject?.id]);

  const handleError = useCallback(() => {
    setVideoError(true);
    setVideoReady(false);
  }, []);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;
      const timeMs = Number(e.target.value);
      video.currentTime = timeMs / 1000;
      setCurrentTimeMs(timeMs);
    },
    [setCurrentTimeMs]
  );

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, [setIsPlaying]);

  const skipForward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
  }, []);

  const skipBackward = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, video.currentTime - 5);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-full h-full max-h-full">
      {/* Video Container */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full flex items-center justify-center min-h-0"
      >
        <div
          className="relative bg-black rounded-md overflow-hidden"
          style={{
            aspectRatio: aspectRatioValue,
            maxWidth: '100%',
            maxHeight: '100%',
            width: aspectRatioValue >= 1 ? '100%' : 'auto',
            height: aspectRatioValue < 1 ? '100%' : 'auto',
          }}
        >
          {videoAsset ? (
            <>
              <video
                key={videoAsset.id}
                ref={videoRef}
                src={videoAsset.fileUrl}
                crossOrigin="anonymous"
                preload="auto"
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                onEnded={handleEnded}
                onError={handleError}
                playsInline
              />

              {/* Loading overlay */}
              {!videoReady && !videoError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                  <Loader2
                    size={32}
                    className="text-accent-primary animate-spin mb-2"
                  />
                  <p className="text-xs text-text-muted">
                    Carregando vídeo...
                  </p>
                </div>
              )}

              {/* Error overlay */}
              {videoError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                  <AlertCircle
                    size={32}
                    className="text-accent-danger mb-2"
                  />
                  <p className="text-xs text-text-muted">
                    Erro ao carregar o vídeo
                  </p>
                  <p className="text-[10px] text-text-muted/60 mt-1 max-w-xs text-center truncate px-4">
                    {videoAsset.fileUrl}
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-text-muted">
              <Play size={40} className="mb-3 opacity-20" />
              <p className="text-xs">Importe um vídeo para começar</p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-2xl flex flex-col gap-2">
        {/* Progress Bar */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-text-muted w-14 text-right font-mono">
            {formatDuration(currentTimeMs)}
          </span>
          <input
            type="range"
            min={0}
            max={durationMs || 100}
            value={currentTimeMs}
            onChange={handleSeek}
            className="flex-1 h-1 cursor-pointer"
          />
          <span className="text-[10px] text-text-muted w-14 font-mono">
            {formatDuration(durationMs)}
          </span>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={skipBackward}
            className="p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
            title="-5s"
          >
            <SkipBack size={14} />
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-2.5 rounded-full bg-bg-surface hover:bg-bg-hover transition-colors text-text-primary border border-border-default/60"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            onClick={skipForward}
            className="p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
            title="+5s"
          >
            <SkipForward size={14} />
          </button>

          <div className="w-px h-4 bg-border-default/60 mx-2" />

          {/* Volume */}
          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            <button
              onClick={toggleMute}
              className="p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
            >
              {isMuted || volume === 0 ? (
                <VolumeX size={14} />
              ) : (
                <Volume2 size={14} />
              )}
            </button>
            {showVolumeSlider && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(Number(e.target.value));
                  if (isMuted) toggleMute();
                }}
                className="w-16 ml-1"
              />
            )}
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary ml-auto"
            title="Tela cheia"
          >
            <Maximize size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
