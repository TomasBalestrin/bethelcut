'use client';

import { useCallback, useState } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';
import { extractWaveformData, decodeAudioFromVideo } from '@/lib/audio/waveform';
import { normalizeWaveform } from '@/lib/audio/audio-utils';

export function useWaveform() {
  const setWaveformData = useAudioStore((s) => s.setWaveformData);
  const setIsAnalyzing = useAudioStore((s) => s.setIsAnalyzing);
  const [error, setError] = useState<string | null>(null);

  const analyzeAudio = useCallback(
    async (videoUrl: string) => {
      setIsAnalyzing(true);
      setError(null);

      try {
        const audioBuffer = await decodeAudioFromVideo(videoUrl);
        const rawData = await extractWaveformData(audioBuffer);
        const normalized = normalizeWaveform(rawData);
        setWaveformData(normalized);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to analyze audio'
        );
      } finally {
        setIsAnalyzing(false);
      }
    },
    [setWaveformData, setIsAnalyzing]
  );

  return { analyzeAudio, error };
}
