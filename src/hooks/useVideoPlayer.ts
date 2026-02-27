'use client';

import { useCallback, useRef, useEffect } from 'react';
import { useEditorStore } from '@/stores/useEditorStore';

export function useVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const setCurrentTimeMs = useEditorStore((s) => s.setCurrentTimeMs);
  const setDurationMs = useEditorStore((s) => s.setDurationMs);
  const volume = useEditorStore((s) => s.volume);
  const isMuted = useEditorStore((s) => s.isMuted);

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

  const seekTo = useCallback(
    (timeMs: number) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = timeMs / 1000;
      setCurrentTimeMs(timeMs);
    },
    [setCurrentTimeMs]
  );

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

  return {
    videoRef,
    seekTo,
    handleTimeUpdate,
    handleLoadedMetadata,
  };
}
