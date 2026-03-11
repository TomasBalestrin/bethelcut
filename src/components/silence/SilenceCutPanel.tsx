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
import {
  Scissors,
  Check,
  X,
  Settings2,
  Volume2,
  Clock,
  Shield,
  Play,
  Trash2,
  Undo2,
  Wand2,
  Loader2,
} from 'lucide-react';
import { analyzeAudioProfile } from '@/lib/audio/smart-silence-analyzer';

type Phase = 'config' | 'detected' | 'cut';

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
  const markSilenceRegions = useTimelineStore((s) => s.markSilenceRegions);
  const cutMarkedSilence = useTimelineStore((s) => s.cutMarkedSilence);
  const undo = useTimelineStore((s) => s.undo);
  const setCurrentTimeMs = useEditorStore((s) => s.setCurrentTimeMs);

  const [error, setError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>('config');
  const [isAutoConfiguring, setIsAutoConfiguring] = useState(false);
  const [audioProfile, setAudioProfile] = useState<{
    noiseFloorDb: number;
    speechLevelDb: number;
    speechPercentage: number;
    silencePercentage: number;
  } | null>(null);

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
    setPhase('config');
    setAnalysisProgress(10);

    try {
      setAnalysisProgress(15);
      const audioBuffer = await decodeAudioFromVideo(videoAsset.fileUrl);

      setAnalysisProgress(50);
      const samplesPerSecond = EDITOR_CONFIG.WAVEFORM_SAMPLES_PER_SECOND;
      const rawData = await extractWaveformData(audioBuffer, samplesPerSecond);
      const normalized = normalizeWaveform(rawData);
      setWaveformData(normalized);

      setAnalysisProgress(80);
      const regions = detectSilenceRegions(normalized, samplesPerSecond, {
        thresholdDb,
        minDurationMs,
        paddingMs,
        sampleRate: audioBuffer.sampleRate,
      });

      // Store with accepted=true by default
      const withAccepted = regions.map((r) => ({ ...r, accepted: true }));
      setSilenceRegions(withAccepted);

      // Mark silence regions on the timeline (split clips at boundaries)
      if (regions.length > 0) {
        markSilenceRegions(regions.map((r) => ({ startMs: r.startMs, endMs: r.endMs })));
      }

      setAnalysisProgress(100);
      setPhase('detected');
    } catch (err) {
      console.error('Silence detection error:', err);
      setError(
        err instanceof Error ? err.message : 'Erro ao analisar o áudio. Verifique se o vídeo possui áudio.'
      );
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [videoAsset, thresholdDb, minDurationMs, paddingMs, setIsAnalyzing, setWaveformData, setSilenceRegions, markSilenceRegions]);

  const handleCut = useCallback(() => {
    cutMarkedSilence();
    setCurrentTimeMs(0);
    setPhase('cut');
  }, [cutMarkedSilence, setCurrentTimeMs]);

  const handleUndo = useCallback(() => {
    undo();
    setPhase('config');
    setSilenceRegions([]);
  }, [undo, setSilenceRegions]);

  const handleRedetect = useCallback(() => {
    // Undo the marks first, then allow redetect
    undo();
    setPhase('config');
    setSilenceRegions([]);
  }, [undo, setSilenceRegions]);

  const handlePreviewRegion = useCallback((startMs: number) => {
    setCurrentTimeMs(Math.max(0, startMs - 500));
  }, [setCurrentTimeMs]);

  const handleAutoConfig = useCallback(async () => {
    if (!videoAsset) return;

    setIsAutoConfiguring(true);
    setError(null);

    try {
      const audioBuffer = await decodeAudioFromVideo(videoAsset.fileUrl);
      const samplesPerSecond = EDITOR_CONFIG.WAVEFORM_SAMPLES_PER_SECOND;
      const rawData = await extractWaveformData(audioBuffer, samplesPerSecond);
      const normalized = normalizeWaveform(rawData);
      setWaveformData(normalized);

      const profile = analyzeAudioProfile(normalized, samplesPerSecond);

      setThresholdDb(profile.recommendedThresholdDb);
      setMinDurationMs(profile.recommendedMinDurationMs);
      setPaddingMs(profile.recommendedPaddingMs);
      setAudioProfile({
        noiseFloorDb: profile.noiseFloorDb,
        speechLevelDb: profile.speechLevelDb,
        speechPercentage: profile.speechPercentage,
        silencePercentage: profile.silencePercentage,
      });
    } catch (err) {
      console.error('Auto-config error:', err);
      setError('Erro ao analisar o áudio automaticamente.');
    } finally {
      setIsAutoConfiguring(false);
    }
  }, [videoAsset, setThresholdDb, setMinDurationMs, setPaddingMs, setWaveformData]);

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

      {/* Smart Auto-Config */}
      {phase === 'config' && (
        <div className="space-y-2">
          <button
            onClick={handleAutoConfig}
            disabled={isAutoConfiguring}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-md bg-accent-primary/8 border border-accent-primary/20 hover:bg-accent-primary/15 text-accent-primary text-xs font-medium transition-colors disabled:opacity-50"
          >
            {isAutoConfiguring ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Analisando áudio...
              </>
            ) : (
              <>
                <Wand2 size={14} />
                Config Inteligente (IA)
              </>
            )}
          </button>

          {audioProfile && (
            <div className="p-2 rounded-md bg-accent-success/8 border border-accent-success/15 space-y-1">
              <p className="text-[10px] text-accent-success font-medium">
                Configuração otimizada aplicada
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-text-muted">
                <span>Ruído de fundo: <span className="text-text-secondary font-mono">{audioProfile.noiseFloorDb} dB</span></span>
                <span>Nível de fala: <span className="text-text-secondary font-mono">{audioProfile.speechLevelDb} dB</span></span>
                <span>Fala: <span className="text-text-secondary font-mono">{audioProfile.speechPercentage}%</span></span>
                <span>Silêncio: <span className="text-text-secondary font-mono">{audioProfile.silencePercentage}%</span></span>
              </div>
            </div>
          )}
        </div>
      )}

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
            disabled={phase !== 'config'}
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
            disabled={phase !== 'config'}
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
            disabled={phase !== 'config'}
          />
          <div className="flex justify-between text-[9px] text-text-muted mt-0.5">
            <span>0ms</span>
            <span>500ms</span>
          </div>
        </div>
      </div>

      {/* Phase: Config - Detect button */}
      {phase === 'config' && (
        <Button
          className="w-full"
          size="sm"
          isLoading={isAnalyzing}
          onClick={handleDetect}
        >
          <Scissors size={14} />
          {isAnalyzing ? 'Analisando áudio...' : 'Detectar Silêncios'}
        </Button>
      )}

      {/* Progress */}
      {isAnalyzing && analysisProgress > 0 && (
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary rounded-full transition-all duration-500"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <p className="text-[10px] text-text-muted text-center">
            {analysisProgress < 20
              ? 'Iniciando análise...'
              : analysisProgress < 50
              ? 'Decodificando áudio do vídeo...'
              : analysisProgress < 80
              ? 'Extraindo waveform...'
              : 'Detectando silêncios...'}
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 rounded-md bg-accent-danger/10 border border-accent-danger/20">
          <p className="text-xs text-accent-danger">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-[10px] text-accent-danger/70 hover:underline mt-1"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Phase: Detected - show regions + CUT button */}
      {phase === 'detected' && silenceRegions.length > 0 && (
        <div className="space-y-2">
          {/* Summary */}
          <div className="p-2.5 rounded-md bg-accent-warning/8 border border-accent-warning/15">
            <p className="text-xs text-text-secondary font-medium mb-1">
              {silenceRegions.length} silêncios detectados
            </p>
            <p className="text-[10px] text-text-muted">
              Os trechos silenciosos estão marcados em vermelho na timeline.
              Revise e clique em <strong>CUT</strong> para removê-los.
            </p>
            <p className="text-[10px] text-text-muted font-mono mt-1">
              Total: {formatDuration(totalSilenceMs)} de silêncio
            </p>
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
                Todos
              </button>
              <span className="text-text-muted text-[10px]">|</span>
              <button
                onClick={rejectAllRegions}
                className="text-[10px] text-accent-danger hover:underline"
              >
                Nenhum
              </button>
            </div>
          </div>

          {/* Region List */}
          <div className="max-h-40 overflow-y-auto space-y-1">
            {silenceRegions.map((region, i) => (
              <div
                key={i}
                className={`flex items-center gap-1.5 p-1.5 rounded-md text-[11px] transition-colors ${
                  region.accepted
                    ? 'bg-accent-danger/8 border border-accent-danger/15'
                    : 'bg-bg-surface border border-border-default/40 opacity-50'
                }`}
              >
                <button
                  onClick={() => toggleSilenceRegion(i)}
                  className={`p-0.5 rounded flex-shrink-0 ${
                    region.accepted ? 'text-accent-danger' : 'text-text-muted'
                  }`}
                >
                  {region.accepted ? <Check size={12} /> : <X size={12} />}
                </button>
                <span className="font-mono text-text-muted flex-1">
                  {formatDuration(region.startMs)} - {formatDuration(region.endMs)}
                </span>
                <span className="text-text-muted/60 font-mono text-[9px]">
                  {((region.endMs - region.startMs) / 1000).toFixed(1)}s
                </span>
                <button
                  onClick={() => handlePreviewRegion(region.startMs)}
                  className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary flex-shrink-0"
                  title="Pré-visualizar"
                >
                  <Play size={10} />
                </button>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="space-y-1.5">
            <Button
              className="w-full"
              size="sm"
              variant="danger"
              disabled={acceptedCount === 0}
              onClick={handleCut}
            >
              <Trash2 size={14} />
              CUT - Remover Silêncios ({acceptedCount})
            </Button>

            <button
              onClick={handleRedetect}
              className="w-full text-[10px] text-text-muted hover:text-text-secondary py-1 hover:underline"
            >
              Alterar configurações e re-detectar
            </button>
          </div>
        </div>
      )}

      {/* Phase: Detected - no silence found */}
      {phase === 'detected' && silenceRegions.length === 0 && (
        <div className="p-2.5 rounded-md bg-accent-success/8 border border-accent-success/15 text-center">
          <p className="text-xs text-accent-success">Nenhum silêncio detectado!</p>
          <p className="text-[10px] text-text-muted mt-1">
            Tente diminuir o threshold para detectar mais.
          </p>
          <button
            onClick={() => setPhase('config')}
            className="text-[10px] text-accent-primary hover:underline mt-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Phase: Cut - done */}
      {phase === 'cut' && (
        <div className="space-y-2">
          <div className="p-2.5 rounded-md bg-accent-success/10 border border-accent-success/20 text-center">
            <p className="text-xs text-accent-success font-medium">
              Cortes aplicados com sucesso!
            </p>
            <p className="text-[10px] text-text-muted mt-1">
              {acceptedCount} trechos silenciosos removidos ({formatDuration(totalSilenceMs)})
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              size="sm"
              variant="secondary"
              onClick={handleUndo}
            >
              <Undo2 size={13} />
              Desfazer
            </Button>
            <Button
              className="flex-1"
              size="sm"
              variant="ghost"
              onClick={() => {
                setPhase('config');
                setSilenceRegions([]);
              }}
            >
              Novo corte
            </Button>
          </div>
        </div>
      )}

      {/* Initial hint */}
      {phase === 'config' && silenceRegions.length === 0 && !isAnalyzing && !error && (
        <p className="text-center text-[10px] text-text-muted py-1 leading-relaxed">
          Analisa o áudio do vídeo e detecta trechos silenciosos
          abaixo de <strong>{thresholdDb} dB</strong>. Os silêncios serão
          marcados na timeline para você revisar antes de cortar.
        </p>
      )}
    </div>
  );
}
