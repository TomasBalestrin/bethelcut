'use client';

import { useCallback, useState } from 'react';
import {
  Bot,
  Scissors,
  Play,
  Check,
  X,
  Undo2,
  Loader2,
  Wand2,
  Volume2,
  Subtitles,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useProjectStore } from '@/stores/useProjectStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { useAudioStore } from '@/stores/useAudioStore';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { decodeAudioFromVideo, extractWaveformData } from '@/lib/audio/waveform';
import { normalizeWaveform } from '@/lib/audio/audio-utils';
import { encodeAudioBufferToWav } from '@/lib/audio/wav-encoder';
import {
  analyzeAudioProfile,
  detectSilenceFromWaveform,
  refineWithTranscription,
  type SmartSilenceRegion,
} from '@/lib/audio/smart-silence-analyzer';
import { EDITOR_CONFIG } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';

type Phase = 'idle' | 'analyzing' | 'review' | 'cut';

interface AICutRegion {
  startMs: number;
  endMs: number;
  durationMs: number;
  type: 'silence' | 'gap' | 'filler';
  accepted: boolean;
  label: string;
}

export function AICutPanel() {
  const mediaAssets = useProjectStore((s) => s.mediaAssets);
  const currentProject = useProjectStore((s) => s.currentProject);
  const tracks = useTimelineStore((s) => s.tracks);
  const markSilenceRegions = useTimelineStore((s) => s.markSilenceRegions);
  const cutMarkedSilence = useTimelineStore((s) => s.cutMarkedSilence);
  const undo = useTimelineStore((s) => s.undo);
  const setCurrentTimeMs = useEditorStore((s) => s.setCurrentTimeMs);
  const setWaveformData = useAudioStore((s) => s.setWaveformData);

  const [phase, setPhase] = useState<Phase>('idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [cutRegions, setCutRegions] = useState<AICutRegion[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    totalSilenceMs: number;
    totalGapMs: number;
    totalFillerMs: number;
    speechPercentage: number;
    regionsCount: number;
    usedTranscription: boolean;
  } | null>(null);

  // Aggressiveness setting
  const [aggressiveness, setAggressiveness] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');

  const videoAsset = mediaAssets.find((a) => a.type === 'video');
  const videoTrack = tracks.find((t) => t.type === 'video');
  const hasClips = videoTrack && videoTrack.clips.length > 0;

  const acceptedRegions = cutRegions.filter((r) => r.accepted);
  const totalCutMs = acceptedRegions.reduce((sum, r) => sum + r.durationMs, 0);

  const getAggressivenessConfig = useCallback(() => {
    switch (aggressiveness) {
      case 'conservative':
        return { minDurationMs: 800, paddingMs: 150, includeFillers: false, thresholdOffset: 5 };
      case 'balanced':
        return { minDurationMs: 400, paddingMs: 100, includeFillers: true, thresholdOffset: 0 };
      case 'aggressive':
        return { minDurationMs: 200, paddingMs: 50, includeFillers: true, thresholdOffset: -5 };
    }
  }, [aggressiveness]);

  const handleAnalyze = useCallback(async () => {
    if (!videoAsset || !currentProject) return;

    setError(null);
    setWarning(null);
    setPhase('analyzing');
    setProgressPercent(0);
    setCutRegions([]);

    const config = getAggressivenessConfig();

    try {
      // Step 1: Decode audio
      setProgressMsg('Decodificando áudio do vídeo...');
      setProgressPercent(5);
      const audioBuffer = await decodeAudioFromVideo(videoAsset.fileUrl);

      // Step 2: Extract waveform
      setProgressMsg('Extraindo waveform...');
      setProgressPercent(15);
      const samplesPerSecond = EDITOR_CONFIG.WAVEFORM_SAMPLES_PER_SECOND;
      const rawData = await extractWaveformData(audioBuffer, samplesPerSecond);
      const normalized = normalizeWaveform(rawData);
      setWaveformData(normalized);

      // Step 3: Analyze audio profile
      setProgressMsg('Analisando perfil de áudio...');
      setProgressPercent(25);
      const profile = analyzeAudioProfile(normalized, samplesPerSecond);

      // Adjust threshold based on aggressiveness
      const effectiveThreshold = profile.recommendedThresholdDb + config.thresholdOffset;

      // Step 4: PRIMARY — Detect silence from waveform (dB-based, always works)
      setProgressMsg('Detectando silêncios no áudio...');
      setProgressPercent(40);

      let silenceRegions: SmartSilenceRegion[] = detectSilenceFromWaveform(
        normalized,
        samplesPerSecond,
        effectiveThreshold,
        config.minDurationMs,
        config.paddingMs
      );

      // Step 5: OPTIONAL — Try to enhance with Whisper transcription
      let usedTranscription = false;
      setProgressMsg('Transcrevendo áudio com IA (Whisper)...');
      setProgressPercent(55);

      try {
        const wavBlob = encodeAudioBufferToWav(audioBuffer);
        const formData = new FormData();
        formData.append('audio', wavBlob, 'audio.wav');
        formData.append('assetId', videoAsset.id);
        formData.append('projectId', currentProject.id);
        formData.append('language', 'pt');

        const response = await fetch('/api/transcription', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          const words = data.transcription.words as { word: string; startMs: number; endMs: number }[];

          // Store transcription for TextBasedEditor too
          useTranscriptionStore.getState().setTranscription({
            id: data.transcription.id,
            fullText: data.transcription.fullText,
            words: data.transcription.words,
            segments: data.transcription.segments,
          });

          // Refine silence regions with word boundaries + detect fillers
          setProgressMsg('Refinando cortes com transcrição...');
          setProgressPercent(80);

          silenceRegions = refineWithTranscription(
            silenceRegions,
            words,
            config.paddingMs,
            config.includeFillers
          );

          usedTranscription = true;
        } else {
          // Whisper failed — continue with dB-only results
          const errData = await response.json().catch(() => null);
          const errMsg = errData?.error || `HTTP ${response.status}`;
          setWarning(`Transcrição indisponível (${errMsg}). Cortes baseados apenas em análise de áudio (dB).`);
        }
      } catch (transcriptionErr) {
        // Network or other error — continue with dB-only
        setWarning('Transcrição falhou. Cortes baseados apenas em análise de áudio (dB).');
        console.warn('Transcription enhancement failed:', transcriptionErr);
      }

      // Step 6: Convert to AICutRegion format
      setProgressMsg('Finalizando regiões de corte...');
      setProgressPercent(90);

      const regions: AICutRegion[] = silenceRegions.map((r) => ({
        startMs: r.startMs,
        endMs: r.endMs,
        durationMs: r.durationMs,
        type: r.type === 'filler' ? ('filler' as const) : ('gap' as const),
        accepted: true,
        label: r.label,
      }));

      // Sort by startMs
      regions.sort((a, b) => a.startMs - b.startMs);

      setCutRegions(regions);

      const totalGapMs = regions
        .filter((r) => r.type === 'gap')
        .reduce((s, r) => s + r.durationMs, 0);
      const totalFillerMs = regions
        .filter((r) => r.type === 'filler')
        .reduce((s, r) => s + r.durationMs, 0);

      setAnalysisResult({
        totalSilenceMs: totalGapMs + totalFillerMs,
        totalGapMs,
        totalFillerMs,
        speechPercentage: profile.speechPercentage,
        regionsCount: regions.length,
        usedTranscription,
      });

      // Mark regions on timeline for preview
      if (regions.length > 0) {
        markSilenceRegions(
          regions.map((r) => ({ startMs: r.startMs, endMs: r.endMs }))
        );
      }

      setProgressPercent(100);
      setPhase('review');
    } catch (err) {
      console.error('AI Cut error:', err);
      setError(err instanceof Error ? err.message : 'Erro na análise com IA');
      setPhase('idle');
    } finally {
      setProgressMsg('');
      setProgressPercent(0);
    }
  }, [videoAsset, currentProject, getAggressivenessConfig, setWaveformData, markSilenceRegions]);

  const handleCut = useCallback(() => {
    const accepted = cutRegions.filter((r) => r.accepted);
    if (accepted.length === 0) return;

    // Undo previous marks, then re-mark only accepted and cut
    undo();
    markSilenceRegions(
      accepted.map((r) => ({ startMs: r.startMs, endMs: r.endMs }))
    );
    cutMarkedSilence();
    setCurrentTimeMs(0);
    setPhase('cut');
  }, [cutRegions, undo, markSilenceRegions, cutMarkedSilence, setCurrentTimeMs]);

  const handleUndo = useCallback(() => {
    undo();
    setPhase('idle');
    setCutRegions([]);
    setAnalysisResult(null);
    setWarning(null);
  }, [undo]);

  const toggleRegion = useCallback((index: number) => {
    setCutRegions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, accepted: !r.accepted } : r))
    );
  }, []);

  const acceptAll = useCallback(() => {
    setCutRegions((prev) => prev.map((r) => ({ ...r, accepted: true })));
  }, []);

  const rejectAll = useCallback(() => {
    setCutRegions((prev) => prev.map((r) => ({ ...r, accepted: false })));
  }, []);

  if (!videoAsset || !hasClips) {
    return (
      <div className="text-center py-8">
        <Bot size={28} className="text-text-muted/40 mx-auto mb-3" />
        <p className="text-xs text-text-secondary">AI CUT</p>
        <p className="text-[10px] text-text-muted mt-1">
          Importe um vídeo para usar o corte inteligente com IA
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bot size={14} className="text-accent-primary" />
        <h3 className="text-xs font-medium text-text-secondary">
          AI CUT - Corte Inteligente
        </h3>
      </div>

      {/* Phase: Idle */}
      {phase === 'idle' && (
        <>
          <p className="text-[10px] text-text-muted leading-relaxed">
            O AI CUT usa <strong>análise de áudio (dB)</strong> para detectar
            silêncios e, quando disponível, <strong>transcrição (Whisper)</strong>{' '}
            para refinar os pontos de corte com precisão nas bordas das palavras.
          </p>

          {/* Aggressiveness */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-text-muted flex items-center gap-1.5">
              <Zap size={10} />
              Nível de corte
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['conservative', 'balanced', 'aggressive'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setAggressiveness(level)}
                  className={`py-1.5 px-2 rounded-md text-[10px] font-medium transition-colors ${
                    aggressiveness === level
                      ? 'bg-accent-primary/15 text-accent-primary border border-accent-primary/30'
                      : 'bg-bg-surface text-text-muted border border-border-default/40 hover:text-text-secondary'
                  }`}
                >
                  {level === 'conservative' && 'Conservador'}
                  {level === 'balanced' && 'Balanceado'}
                  {level === 'aggressive' && 'Agressivo'}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-text-muted">
              {aggressiveness === 'conservative' &&
                'Remove apenas silêncios longos (>800ms). Mais seguro.'}
              {aggressiveness === 'balanced' &&
                'Remove silêncios >400ms e filler words. Recomendado.'}
              {aggressiveness === 'aggressive' &&
                'Remove gaps >200ms e fillers. Ritmo mais rápido.'}
            </p>
          </div>

          {/* Features */}
          <div className="p-2 rounded-md bg-bg-surface/50 border border-border-default/30 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
              <Volume2 size={10} className="text-accent-primary flex-shrink-0" />
              <span>Detecção de silêncio por análise de áudio (dB)</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
              <Subtitles size={10} className="text-accent-primary flex-shrink-0" />
              <span>Refinamento com transcrição Whisper (quando disponível)</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
              <Wand2 size={10} className="text-accent-primary flex-shrink-0" />
              <span>Config automática de threshold e padding</span>
            </div>
          </div>

          <Button
            className="w-full"
            size="sm"
            onClick={handleAnalyze}
          >
            <Bot size={14} />
            Analisar e Cortar com IA
          </Button>
        </>
      )}

      {/* Phase: Analyzing */}
      {phase === 'analyzing' && (
        <div className="space-y-3">
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 size={24} className="text-accent-primary animate-spin" />
            <p className="text-xs text-text-secondary text-center">
              {progressMsg || 'Processando...'}
            </p>
          </div>

          <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="space-y-1 text-[9px] text-text-muted">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${progressPercent >= 5 ? 'bg-accent-success' : 'bg-text-muted/30'}`} />
              Decodificar áudio
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${progressPercent >= 25 ? 'bg-accent-success' : 'bg-text-muted/30'}`} />
              Analisar perfil de áudio
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${progressPercent >= 40 ? 'bg-accent-success' : 'bg-text-muted/30'}`} />
              Detectar silêncios (dB)
            </div>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${progressPercent >= 80 ? 'bg-accent-success' : 'bg-text-muted/30'}`} />
              Refinar com transcrição (Whisper)
            </div>
          </div>
        </div>
      )}

      {/* Warning (e.g. Whisper unavailable) */}
      {warning && (
        <div className="p-2 rounded-md bg-accent-warning/10 border border-accent-warning/20 flex items-start gap-2">
          <AlertTriangle size={12} className="text-accent-warning flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-accent-warning/90">{warning}</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 rounded-md bg-accent-danger/10 border border-accent-danger/20">
          <p className="text-xs text-accent-danger">{error}</p>
          <button
            onClick={() => { setError(null); setPhase('idle'); }}
            className="text-[10px] text-accent-danger/70 hover:underline mt-1"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Phase: Review */}
      {phase === 'review' && (
        <div className="space-y-2">
          {/* Analysis Summary */}
          {analysisResult && (
            <div className="p-2.5 rounded-md bg-accent-primary/8 border border-accent-primary/15 space-y-1.5">
              <p className="text-xs text-text-secondary font-medium">
                {analysisResult.regionsCount} regiões de corte identificadas
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] text-text-muted">
                <span>Silêncios: <span className="text-text-secondary font-mono">{formatDuration(analysisResult.totalGapMs)}</span></span>
                <span>Filler words: <span className="text-text-secondary font-mono">{formatDuration(analysisResult.totalFillerMs)}</span></span>
                <span>Total removível: <span className="text-text-secondary font-mono">{formatDuration(analysisResult.totalSilenceMs)}</span></span>
                <span>Fala no vídeo: <span className="text-text-secondary font-mono">{analysisResult.speechPercentage}%</span></span>
              </div>
              <div className="text-[9px] text-text-muted mt-1">
                {analysisResult.usedTranscription
                  ? <span className="text-accent-success">Refinado com transcrição Whisper</span>
                  : <span className="text-accent-warning">Baseado em análise de áudio (dB)</span>
                }
              </div>
            </div>
          )}

          {/* Accept/Reject All */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">
              {acceptedRegions.length} de {cutRegions.length} selecionados
              ({formatDuration(totalCutMs)})
            </span>
            <div className="flex gap-1">
              <button onClick={acceptAll} className="text-[10px] text-accent-success hover:underline">
                Todos
              </button>
              <span className="text-text-muted text-[10px]">|</span>
              <button onClick={rejectAll} className="text-[10px] text-accent-danger hover:underline">
                Nenhum
              </button>
            </div>
          </div>

          {/* Toggle details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between py-1 text-[10px] text-text-muted hover:text-text-secondary"
          >
            <span>{showDetails ? 'Ocultar' : 'Ver'} detalhes dos cortes</span>
            {showDetails ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Region List */}
          {showDetails && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {cutRegions.map((region, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-1.5 p-1.5 rounded-md text-[10px] transition-colors ${
                    region.accepted
                      ? region.type === 'filler'
                        ? 'bg-accent-warning/8 border border-accent-warning/15'
                        : 'bg-accent-danger/8 border border-accent-danger/15'
                      : 'bg-bg-surface border border-border-default/40 opacity-50'
                  }`}
                >
                  <button
                    onClick={() => toggleRegion(i)}
                    className={`p-0.5 rounded flex-shrink-0 ${
                      region.accepted
                        ? region.type === 'filler'
                          ? 'text-accent-warning'
                          : 'text-accent-danger'
                        : 'text-text-muted'
                    }`}
                  >
                    {region.accepted ? <Check size={11} /> : <X size={11} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-text-muted">
                      {formatDuration(region.startMs)} - {formatDuration(region.endMs)}
                    </span>
                    <span className="text-text-muted/50 ml-1">
                      ({(region.durationMs / 1000).toFixed(1)}s)
                    </span>
                    <p className="text-[9px] text-text-muted/70 truncate">{region.label}</p>
                  </div>
                  <span className={`text-[8px] px-1 py-0.5 rounded ${
                    region.type === 'filler'
                      ? 'bg-accent-warning/10 text-accent-warning'
                      : 'bg-accent-danger/10 text-accent-danger'
                  }`}>
                    {region.type === 'filler' ? 'FILLER' : 'GAP'}
                  </span>
                  <button
                    onClick={() => setCurrentTimeMs(Math.max(0, region.startMs - 500))}
                    className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary flex-shrink-0"
                  >
                    <Play size={9} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-1.5">
            <Button
              className="w-full"
              size="sm"
              variant="danger"
              disabled={acceptedRegions.length === 0}
              onClick={handleCut}
            >
              <Scissors size={14} />
              AI CUT - Aplicar Cortes ({acceptedRegions.length})
            </Button>

            <button
              onClick={handleUndo}
              className="w-full text-[10px] text-text-muted hover:text-text-secondary py-1 hover:underline"
            >
              Cancelar e voltar
            </button>
          </div>
        </div>
      )}

      {/* Phase: Cut done */}
      {phase === 'cut' && (
        <div className="space-y-2">
          <div className="p-2.5 rounded-md bg-accent-success/10 border border-accent-success/20 text-center">
            <p className="text-xs text-accent-success font-medium">
              AI CUT aplicado com sucesso!
            </p>
            <p className="text-[10px] text-text-muted mt-1">
              {acceptedRegions.length} cortes realizados ({formatDuration(totalCutMs)} removidos)
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
                setPhase('idle');
                setCutRegions([]);
                setAnalysisResult(null);
                setWarning(null);
              }}
            >
              Novo corte
            </Button>
          </div>
        </div>
      )}

      {/* Initial hint */}
      {phase === 'idle' && !error && (
        <p className="text-center text-[9px] text-text-muted py-1 leading-relaxed">
          Funciona mesmo sem API de transcrição configurada.
          Com Whisper ativado, os cortes ficam ainda mais precisos.
        </p>
      )}
    </div>
  );
}
