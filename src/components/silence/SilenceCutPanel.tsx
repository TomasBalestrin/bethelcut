'use client';

import { useCallback, useState } from 'react';
import { useAudioStore } from '@/stores/useAudioStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { decodeAudioFromVideo, extractWaveformData } from '@/lib/audio/waveform';
import { normalizeWaveform } from '@/lib/audio/audio-utils';
import { detectSilenceRegions } from '@/lib/audio/silence-detector';
import { EDITOR_CONFIG } from '@/lib/constants';
import { Button } from '@/components/ui/Button';
import { formatDuration } from '@/lib/utils';
import { Scissors, Check, X, Settings2, Volume2, Clock, Shield, Play } from 'lucide-react';

export function SilenceCutPanel() {
  const {
    silenceRegions,
    isAnalyzing,
    thresholdDb,
    minDurationMs,
    paddingMs,
    setThresholdDb,
    setMinDurationMs,
    setPaddingMs,
    setIsAnalyzing,
    setWaveformData,
    setSilenceRegions,
    toggleSilenceRegion,
    acceptAllRegions,
    rejectAllRegions,
  } = useAudioStore();

  const mediaAssets = useProjectStore((s) => s.mediaAssets);
  const tracks = useTimelineStore((s) => s.tracks);
  const removeSilenceRegions = useTimelineStore((s) => s.removeSilenceRegions);
  const setCurrentTimeMs = useEditorStore((s) => s.setCurrentTimeMs);
  const durationMs = useEditorStore((s) => s.durationMs);
  const setDurationMs = useEditorStore((s) => s.setDurationMs);

  const [error, setError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [cutsApplied, setCutsApplied] = useState(false);

  const videoAsset = mediaAssets.find((a) => a.type === 'video');
  const videoTrack = tracks.find((t) => t.type === 'video');
  const hasClips = videoTrack && videoTrack.clips.length > 0;

  const acceptedCount = silenceRegions.filter((r) => r.accepted).length;
  const totalSilenceMs = silenceRegions
    .filter((r) => r.accepted)
    .reduce((sum, r) => sum + (r.endMs - r.startMs), 0);

  const handleDetect = useCallback(async () => {
    if (!videoAsset) return;

    setError(null);
    setIsAnalyzing(true);
    setCutsApplied(false);
    setAnalysisProgress(10);

    try {
      // Decode audio from video
      setAnalysisProgress(20);
      const audioBuffer = await decodeAudioFromVideo(videoAsset.fileUrl);

      // Extract waveform
      setAnalysisProgress(50);
      const samplesPerSecond = EDITOR_CONFIG.WAVEFORM_SAMPLES_PER_SECOND;
      const rawData = await extractWaveformData(audioBuffer, samplesPerSecond);
      const normalized = normalizeWaveform(rawData);
      setWaveformData(normalized);

      // Detect silence
      setAnalysisProgress(80);
      const regions = detectSilenceRegions(normalized, samplesPerSecond, {
        thresholdDb,
        minDurationMs,
        paddingMs,
        sampleRate: audioBuffer.sampleRate,
      });

      // Store with accepted=true by default
      setSilenceRegions(
        regions.map((r) => ({ ...r, accepted: true }))
      );

      setAnalysisProgress(100);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erro ao analisar o áudio'
      );
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [videoAsset, thresholdDb, minDurationMs, paddingMs, setIsAnalyzing, setWaveformData, setSilenceRegions]);

  const handleApplyCuts = useCallback(() => {
    const accepted = silenceRegions.filter((r) => r.accepted);
    if (accepted.length === 0) return;

    removeSilenceRegions(accepted.map((r) => ({ startMs: r.startMs, endMs: r.endMs })));

    // Update duration after cutting
    const newDuration = durationMs - totalSilenceMs;
    if (newDuration > 0) {
      setDurationMs(newDuration);
    }

    // Move playhead to start
    setCurrentTimeMs(0);
    setCutsApplied(true);
  }, [silenceRegions, removeSilenceRegions, durationMs, totalSilenceMs, setDurationMs, setCurrentTimeMs]);

  const handlePreviewRegion = useCallback((startMs: number) => {
    setCurrentTimeMs(Math.max(0, startMs - 500));
  }, [setCurrentTimeMs]);

  if (!videoAsset || !hasClips) {
    return (
      <div className="text-center py-8">
        <Scissors size={28} className="text-text-muted/40 mx-auto mb-3" />
        <p className="text-xs text-text-secondary">Corte de Silêncio</p>
        <p className="text-[10px] text-text-muted mt-1">
          Importe um vídeo para detectar e remover silêncios
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Scissors size={14} className="text-accent-primary" />
        <h3 className="text-xs font-medium text-text-secondary">Corte de Silêncio</h3>
      </div>

      {/* Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Settings2 size={12} />
          Configurações
        </div>

        <div>
          <label className="text-xs text-text-muted flex items-center gap-1.5 mb-1">
            <Volume2 size={11} />
            Threshold: <span className="text-text-secondary font-mono">{thresholdDb} dB</span>
          </label>
          <input
            type="range"
            min={-60}
            max={-10}
            value={thresholdDb}
            onChange={(e) => setThresholdDb(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
            <span>-60 dB (mais sensível)</span>
            <span>-10 dB (menos sensível)</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-text-muted flex items-center gap-1.5 mb-1">
            <Clock size={11} />
            Duração mínima: <span className="text-text-secondary font-mono">{minDurationMs}ms</span>
          </label>
          <input
            type="range"
            min={100}
            max={3000}
            step={100}
            value={minDurationMs}
            onChange={(e) => setMinDurationMs(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
            <span>100ms</span>
            <span>3000ms</span>
          </div>
        </div>

        <div>
          <label className="text-xs text-text-muted flex items-center gap-1.5 mb-1">
            <Shield size={11} />
            Padding: <span className="text-text-secondary font-mono">{paddingMs}ms</span>
          </label>
          <input
            type="range"
            min={0}
            max={500}
            step={25}
            value={paddingMs}
            onChange={(e) => setPaddingMs(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
            <span>0ms</span>
            <span>500ms</span>
          </div>
        </div>
      </div>

      {/* Analyze Button */}
      <Button
        className="w-full"
        size="sm"
        isLoading={isAnalyzing}
        onClick={handleDetect}
      >
        <Scissors size={14} />
        {isAnalyzing ? 'Analisando...' : 'Detectar Silêncios'}
      </Button>

      {/* Progress */}
      {isAnalyzing && analysisProgress > 0 && (
        <div className="w-full h-1 bg-bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-primary rounded-full transition-all duration-300"
            style={{ width: `${analysisProgress}%` }}
          />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 rounded-md bg-accent-danger/10 border border-accent-danger/20">
          <p className="text-xs text-accent-danger">{error}</p>
        </div>
      )}

      {/* Results */}
      {silenceRegions.length > 0 && (
        <div className="space-y-2">
          {/* Summary */}
          <div className="p-2 rounded-md bg-bg-surface border border-border-default/40">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary">
                {silenceRegions.length} silêncios encontrados
              </span>
              <span className="text-text-muted font-mono">
                {formatDuration(totalSilenceMs)} para cortar
              </span>
            </div>
          </div>

          {/* Accept/Reject All */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">
              {acceptedCount} de {silenceRegions.length} selecionados
            </span>
            <div className="flex gap-1">
              <button
                onClick={acceptAllRegions}
                className="text-[10px] text-accent-success hover:underline"
              >
                Selecionar todos
              </button>
              <span className="text-text-muted text-[10px]">|</span>
              <button
                onClick={rejectAllRegions}
                className="text-[10px] text-accent-danger hover:underline"
              >
                Desmarcar todos
              </button>
            </div>
          </div>

          {/* Region List */}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {silenceRegions.map((region, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 p-2 rounded-md text-xs transition-colors ${
                  region.accepted
                    ? 'bg-accent-danger/8 border border-accent-danger/15'
                    : 'bg-bg-surface border border-border-default/40'
                }`}
              >
                <button
                  onClick={() => toggleSilenceRegion(i)}
                  className={`p-0.5 rounded flex-shrink-0 ${
                    region.accepted
                      ? 'text-accent-danger'
                      : 'text-text-muted'
                  }`}
                >
                  {region.accepted ? (
                    <Check size={14} />
                  ) : (
                    <X size={14} />
                  )}
                </button>
                <span className="font-mono text-text-muted flex-1">
                  {formatDuration(region.startMs)} - {formatDuration(region.endMs)}
                </span>
                <span className="text-text-muted/60 font-mono text-[10px]">
                  {((region.endMs - region.startMs) / 1000).toFixed(1)}s
                </span>
                <button
                  onClick={() => handlePreviewRegion(region.startMs)}
                  className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary flex-shrink-0"
                  title="Pré-visualizar"
                >
                  <Play size={11} />
                </button>
              </div>
            ))}
          </div>

          {/* Apply Button */}
          {!cutsApplied ? (
            <Button
              className="w-full"
              size="sm"
              variant="danger"
              disabled={acceptedCount === 0}
              onClick={handleApplyCuts}
            >
              <Scissors size={14} />
              Aplicar Cortes ({acceptedCount})
            </Button>
          ) : (
            <div className="p-2 rounded-md bg-accent-success/10 border border-accent-success/20 text-center">
              <p className="text-xs text-accent-success">
                Cortes aplicados! Use Ctrl+Z para desfazer.
              </p>
            </div>
          )}
        </div>
      )}

      {silenceRegions.length === 0 && !isAnalyzing && !error && (
        <p className="text-center text-[10px] text-text-muted py-2">
          Clique em &quot;Detectar Silêncios&quot; para analisar o áudio
        </p>
      )}
    </div>
  );
}
