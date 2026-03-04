'use client';

import { useEffect, useRef } from 'react';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { decodeAudioFromVideo, extractWaveformData } from '@/lib/audio/waveform';
import { normalizeWaveform } from '@/lib/audio/audio-utils';

/**
 * Automatically extracts audio waveform when a video clip is present on the timeline.
 * The waveform is used to render audio visualization inside clips.
 */
export function useAutoWaveform() {
  const tracks = useTimelineStore((s) => s.tracks);
  const mediaAssets = useProjectStore((s) => s.mediaAssets);
  const waveformData = useAudioStore((s) => s.waveformData);
  const setWaveformData = useAudioStore((s) => s.setWaveformData);
  const isAnalyzing = useAudioStore((s) => s.isAnalyzing);
  const setIsAnalyzing = useAudioStore((s) => s.setIsAnalyzing);

  const analyzedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if already analyzing or waveform already exists for this video
    if (isAnalyzing) return;
    if (waveformData.length > 0) return;

    // Find a video clip on the timeline
    const videoTrack = tracks.find((t) => t.type === 'video');
    const firstVideoClip = videoTrack?.clips.find((c) => c.assetId && c.clipType !== 'silence_marker');
    if (!firstVideoClip?.assetId) return;

    // Find the corresponding asset
    const asset = mediaAssets.find((a) => a.id === firstVideoClip.assetId);
    if (!asset?.fileUrl) return;

    // Don't re-analyze the same URL
    if (analyzedUrlRef.current === asset.fileUrl) return;
    analyzedUrlRef.current = asset.fileUrl;

    // Extract waveform in background
    const extract = async () => {
      setIsAnalyzing(true);
      try {
        const audioBuffer = await decodeAudioFromVideo(asset.fileUrl);
        const rawData = await extractWaveformData(audioBuffer);
        const normalized = normalizeWaveform(rawData);
        setWaveformData(normalized);
      } catch (err) {
        console.warn('Auto waveform extraction failed:', err);
        // Reset so it can retry if needed
        analyzedUrlRef.current = null;
      } finally {
        setIsAnalyzing(false);
      }
    };

    extract();
  }, [tracks, mediaAssets, waveformData.length, isAnalyzing, setWaveformData, setIsAnalyzing]);
}
