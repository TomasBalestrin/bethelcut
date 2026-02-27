'use client';

import { useAudioStore } from '@/stores/useAudioStore';
import { WaveformRenderer } from '@/components/editor/WaveformRenderer';

export function SilenceDetector() {
  const waveformData = useAudioStore((s) => s.waveformData);
  const isAnalyzing = useAudioStore((s) => s.isAnalyzing);

  if (waveformData.length === 0) {
    return (
      <div className="flex items-center justify-center h-20 text-xs text-text-muted">
        {isAnalyzing ? 'Analisando áudio...' : 'Importe um vídeo para analisar'}
      </div>
    );
  }

  return (
    <div className="p-2">
      <WaveformRenderer data={waveformData} width={600} height={60} />
    </div>
  );
}
