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
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const videoAsset = mediaAssets.find((a) => a.type === 'video');
  const ratioConfig = ASPECT_RATIOS[aspectRatio];
  const aspectRatioValue = ratioConfig.width / ratioConfig.height;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(() => setIsPlaying(false));
    } else {
      video.pause();
    }
  }, [isPlaying, setIsPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
    video.muted = isMuted;
  }, [volume, isMuted]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTimeMs(Math.round(video.currentTime * 1000));
  }, [setCurrentTimeMs]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setDurationMs(Math.round(video.duration * 1000));
  }, [setDurationMs]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const video = videoRef.current;
      if (!video) return;
      const time = Number(e.target.value) / 1000;
      video.currentTime = time;
      setCurrentTimeMs(Number(e.target.value));
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
