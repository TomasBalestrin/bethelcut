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
  const supabase = createClient();

  // Find the video track and active clip from the timeline
  const videoTrack = tracks.find((t) => t.type === 'video');
  const activeClip = videoTrack?.clips.find(
    (c) => currentTimeMs >= c.startTimeMs && currentTimeMs < c.endTimeMs
  );
  const fallbackClip = videoTrack?.clips[0];
  const currentClip = activeClip || fallbackClip;

  // Get the media asset for the active clip
  const videoAsset = currentClip?.assetId
    ? mediaAssets.find((a) => a.id === currentClip.assetId)
    : mediaAssets.find((a) => a.type === 'video');

  const ratioConfig = ASPECT_RATIOS[aspectRatio];
  const aspectRatioValue = ratioConfig.width / ratioConfig.height;

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
    if (!video || !Number.isFinite(video.duration)) return;

    const videoTimeMs = Math.round(video.currentTime * 1000);
    // Only seek if the difference is significant (= external change, not from timeupdate)
    if (Math.abs(currentTimeMs - videoTimeMs) > 250) {
      video.currentTime = Math.max(
        0,
        Math.min(video.duration, currentTimeMs / 1000)
      );
    }
  }, [currentTimeMs]);

  // Video drives currentTimeMs while playing
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTimeMs(Math.round(video.currentTime * 1000));
  }, [setCurrentTimeMs]);

  // When video metadata loads, fix duration and clip if needed
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const realDurationMs = Math.round(video.duration * 1000);
    if (realDurationMs <= 0 || !Number.isFinite(realDurationMs)) return;

    // Update project duration
    setDurationMs(realDurationMs);

    // Fix clip duration if it was created with a default (30s)
    if (currentClip && videoTrack) {
      const clipDuration = currentClip.endTimeMs - currentClip.startTimeMs;
      if (Math.abs(clipDuration - realDurationMs) > 500) {
        const newEndTime = currentClip.startTimeMs + realDurationMs;

        // Update clip in store
        updateClip(videoTrack.id, currentClip.id, {
          endTimeMs: newEndTime,
          sourceOutMs: realDurationMs,
        });

        // Persist clip update to DB
        supabase
          .from('timeline_clips')
          .update({
            end_time_ms: newEndTime,
            source_out_ms: realDurationMs,
          })
          .eq('id', currentClip.id);

        // Update media asset duration in DB
        if (currentClip.assetId) {
          supabase
            .from('media_assets')
            .update({ duration_ms: realDurationMs })
            .eq('id', currentClip.assetId);
        }

        // Update project duration in DB
        if (currentProject) {
          supabase
            .from('projects')
            .update({ duration_ms: newEndTime })
            .eq('id', currentProject.id);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDurationMs, currentClip?.id, videoTrack?.id, currentProject?.id]);

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
    video.currentTime = Math.min(video.duration, video.currentTime + 5);
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
            <video
              ref={videoRef}
              src={videoAsset.fileUrl}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
              playsInline
            />
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
