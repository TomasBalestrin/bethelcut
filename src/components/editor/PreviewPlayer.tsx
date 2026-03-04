'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
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
  const seekingRef = useRef(false);

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

  // Get all video clips sorted by startTimeMs
  const videoTrack = tracks.find((t) => t.type === 'video');
  const videoClips = useMemo(() => {
    if (!videoTrack) return [];
    return [...videoTrack.clips].sort((a, b) => a.startTimeMs - b.startTimeMs);
  }, [videoTrack]);

  // Find the active clip at the current playhead position
  const activeClip = useMemo(() => {
    return videoClips.find(
      (c) => currentTimeMs >= c.startTimeMs && currentTimeMs < c.endTimeMs
    ) ?? null;
  }, [videoClips, currentTimeMs]);

  // Resolve the video asset for the active clip
  const activeAsset = activeClip?.assetId
    ? mediaAssets.find((a) => a.id === activeClip.assetId)
    : null;

  // Fallback: if no active clip but we have assets, use first video asset
  const fallbackAsset = mediaAssets.find((a) => a.type === 'video');
  const videoAsset = activeAsset || (videoClips.length === 0 ? fallbackAsset : null);

  // Compute the total timeline duration from all clips
  const totalDuration = useMemo(() => {
    if (videoClips.length === 0) return durationMs;
    const maxEnd = Math.max(...videoClips.map((c) => c.endTimeMs));
    return Math.max(durationMs, maxEnd);
  }, [videoClips, durationMs]);

  const ratioConfig = ASPECT_RATIOS[aspectRatio];
  const aspectRatioValue = ratioConfig.width / ratioConfig.height;

  // Reset video states when active asset changes
  useEffect(() => {
    setVideoReady(false);
    setVideoError(false);
  }, [videoAsset?.id]);

  // Play/Pause sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying && activeClip) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, setIsPlaying, activeClip]);

  // Volume sync
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  // Sync video position to active clip's source time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !activeClip || seekingRef.current) return;

    // Calculate where in the source file we should be
    const clipDuration = activeClip.endTimeMs - activeClip.startTimeMs;
    const offsetInClip = currentTimeMs - activeClip.startTimeMs;
    const sourceDuration = activeClip.sourceOutMs - activeClip.sourceInMs;
    const ratio = clipDuration > 0 ? offsetInClip / clipDuration : 0;
    const targetSourceMs = activeClip.sourceInMs + sourceDuration * ratio;
    const targetSec = targetSourceMs / 1000;

    const videoTimeMs = Math.round(video.currentTime * 1000);
    const targetMs = Math.round(targetSourceMs);

    // Only seek if difference is significant (avoid oscillation)
    if (Math.abs(videoTimeMs - targetMs) > 150) {
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.max(0, Math.min(video.duration, targetSec));
      } else {
        video.currentTime = Math.max(0, targetSec);
      }
    }
  }, [currentTimeMs, activeClip]);

  // Video drives currentTimeMs while playing - map source time back to timeline time
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || seekingRef.current) return;

    const clip = useTimelineStore.getState().tracks
      .find((t) => t.type === 'video')
      ?.clips.find((c) => {
        const sourceMs = video.currentTime * 1000;
        return sourceMs >= c.sourceInMs - 50 && sourceMs <= c.sourceOutMs + 50;
      });

    if (clip) {
      const sourceDuration = clip.sourceOutMs - clip.sourceInMs;
      const clipDuration = clip.endTimeMs - clip.startTimeMs;
      const sourceOffset = video.currentTime * 1000 - clip.sourceInMs;
      const ratio = sourceDuration > 0 ? sourceOffset / sourceDuration : 0;
      const timelineMs = clip.startTimeMs + clipDuration * ratio;
      setCurrentTimeMs(Math.round(Math.max(clip.startTimeMs, Math.min(clip.endTimeMs, timelineMs))));
    } else {
      setCurrentTimeMs(Math.round(video.currentTime * 1000));
    }
  }, [setCurrentTimeMs]);

  // Handle end of active clip during playback - advance to next clip
  useEffect(() => {
    if (!isPlaying || !activeClip) return;

    const video = videoRef.current;
    if (!video) return;

    const checkClipEnd = () => {
      if (!isPlaying) return;
      const sourceTimeMs = video.currentTime * 1000;
      if (sourceTimeMs >= activeClip.sourceOutMs - 30) {
        // Find next clip
        const nextClip = videoClips.find((c) => c.startTimeMs >= activeClip.endTimeMs);
        if (nextClip) {
          setCurrentTimeMs(nextClip.startTimeMs);
        } else {
          // No more clips - stop
          setIsPlaying(false);
          setCurrentTimeMs(activeClip.endTimeMs);
        }
      }
    };

    const interval = setInterval(checkClipEnd, 50);
    return () => clearInterval(interval);
  }, [isPlaying, activeClip, videoClips, setCurrentTimeMs, setIsPlaying]);

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
    const firstClip = videoClips[0];
    if (firstClip && videoTrack) {
      const clipDuration = firstClip.endTimeMs - firstClip.startTimeMs;
      if (Math.abs(clipDuration - realDurationMs) > 500 && videoClips.length === 1) {
        const newEndTime = firstClip.startTimeMs + realDurationMs;

        // Update clip in store
        updateClip(videoTrack.id, firstClip.id, {
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
          .eq('id', firstClip.id);

        if (firstClip.assetId) {
          supabase
            .from('media_assets')
            .update({ duration_ms: realDurationMs })
            .eq('id', firstClip.assetId);
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
  }, [setDurationMs, videoClips, videoTrack?.id, currentProject?.id]);

  const handleError = useCallback(() => {
    setVideoError(true);
    setVideoReady(false);
  }, []);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      seekingRef.current = true;
      const timeMs = Number(e.target.value);
      setCurrentTimeMs(timeMs);

      // Find the clip at the seek position and set video time
      const video = videoRef.current;
      const clip = videoClips.find(
        (c) => timeMs >= c.startTimeMs && timeMs < c.endTimeMs
      );
      if (video && clip) {
        const clipDuration = clip.endTimeMs - clip.startTimeMs;
        const offset = timeMs - clip.startTimeMs;
        const sourceDuration = clip.sourceOutMs - clip.sourceInMs;
        const ratio = clipDuration > 0 ? offset / clipDuration : 0;
        const sourceTime = (clip.sourceInMs + sourceDuration * ratio) / 1000;
        video.currentTime = sourceTime;
      }

      // Release seeking flag after a tick
      requestAnimationFrame(() => {
        seekingRef.current = false;
      });
    },
    [setCurrentTimeMs, videoClips]
  );

  const handleEnded = useCallback(() => {
    // Don't stop - the clip end check interval handles advancing
  }, []);

  const skipForward = useCallback(() => {
    const newTime = Math.min(totalDuration, currentTimeMs + 5000);
    setCurrentTimeMs(newTime);
  }, [currentTimeMs, totalDuration, setCurrentTimeMs]);

  const skipBackward = useCallback(() => {
    const newTime = Math.max(0, currentTimeMs - 5000);
    setCurrentTimeMs(newTime);
  }, [currentTimeMs, setCurrentTimeMs]);

  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen();
    }
  }, []);

  // Show black when playhead is in a gap (no active clip)
  const isInGap = videoClips.length > 0 && !activeClip;

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
                style={{ opacity: isInGap ? 0 : 1 }}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onCanPlay={handleCanPlay}
                onEnded={handleEnded}
                onError={handleError}
                playsInline
              />

              {/* Gap overlay - show black when between clips */}
              {isInGap && (
                <div className="absolute inset-0 bg-black" />
              )}

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
              <p className="text-xs">
                {videoClips.length > 0 && isInGap
                  ? 'Espaço vazio na timeline'
                  : 'Importe um vídeo para começar'}
              </p>
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
            max={totalDuration || 100}
            value={currentTimeMs}
            onChange={handleSeek}
            className="flex-1 h-1 cursor-pointer"
          />
          <span className="text-[10px] text-text-muted w-14 font-mono">
            {formatDuration(totalDuration)}
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
