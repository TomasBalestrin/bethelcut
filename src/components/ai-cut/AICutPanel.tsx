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
  VolumeX,
  Subtitles,
  Zap,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  MessageCircle,
  Shield,
  Mic,
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
import { analyzeAudioProfile } from '@/lib/audio/smart-silence-analyzer';
import {
  mapSpeechRegions,
  extractCandidateZones,
  classifyAllRegions,
  detectFillerWords,
  mergeAdjacentRegions,
  type ClassifiedRegion,
} from '@/lib/audio/noise-classifier';
import { EDITOR_CONFIG } from '@/lib/constants';
import { formatDuration } from '@/lib/utils';

type Phase = 'idle' | 'analyzing' | 'review' | 'cut' | 'done';

interface AICutRegion extends ClassifiedRegion {
  accepted: boolean;
}

interface AnalysisStats {
  totalDurationMs: number;
  speechDurationMs: number;
  speechPercentage: number;
  silenceCount: number;
  silenceTotalMs: number;
  noiseCount: number;
  noiseTotalMs: number;
  fillerCount: number;
  fillerTotalMs: number;
  totalRemovableMs: number;
  wordsDetected: number;
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
  const [cutRegions, setCutRegions] = useState<AICutRegion[]>([]);
  const [stats, setStats] = useState<AnalysisStats | null>(null);

  // UI state
  const [showSilences, setShowSilences] = useState(false);
  const [showNoises, setShowNoises] = useState(false);
  const [showFillers, setShowFillers] = useState(false);

  // Aggressiveness setting
  const [aggressiveness, setAggressiveness] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');

  const videoAsset = mediaAssets.find((a) => a.type === 'video');
  const videoTrack = tracks.find((t) => t.type === 'video');
  const hasClips = videoTrack && videoTrack.clips.length > 0;

  const acceptedRegions = cutRegions.filter((r) => r.accepted);
  const totalCutMs = acceptedRegions.reduce((sum, r) => sum + r.durationMs, 0);

  const silenceRegions = cutRegions.filter((r) => r.type === 'silence');
  const noiseRegions = cutRegions.filter((r) => r.type === 'noise');
  const fillerRegions = cutRegions.filter((r) => r.type === 'filler');

  const getAggressivenessConfig = useCallback(() => {
    switch (aggressiveness) {
      case 'conservative':
        return { minSilenceMs: 800, minNoiseMs: 500, paddingMs: 200, includeFillers: false };
      case 'balanced':
        return { minSilenceMs: 400, minNoiseMs: 300, paddingMs: 120, includeFillers: true };
      case 'aggressive':
        return { minSilenceMs: 200, minNoiseMs: 150, paddingMs: 60, includeFillers: true };
    }
  }, [aggressiveness]);

  // ─── Main Analysis Pipeline ──────────────────────────────

  const handleAnalyze = useCallback(async () => {
    if (!videoAsset || !currentProject) return;

    setError(null);
    setPhase('analyzing');
    setProgressPercent(0);
    setCutRegions([]);
    setStats(null);

    const config = getAggressivenessConfig();

    try {
      // ── Step 1: Decode Audio ──
      setProgressMsg('Decodificando áudio do vídeo...');
      setProgressPercent(5);
      const audioBuffer = await decodeAudioFromVideo(videoAsset.fileUrl);

      // ── Step 2: Extract Waveform ──
      setProgressMsg('Extraindo waveform...');
      setProgressPercent(10);
      const samplesPerSecond = EDITOR_CONFIG.WAVEFORM_SAMPLES_PER_SECOND;
      const rawData = await extractWaveformData(audioBuffer, samplesPerSecond);
      const normalized = normalizeWaveform(rawData);
      setWaveformData(normalized);

      // ── Step 3: Transcribe with Whisper (REQUIRED) ──
      setProgressMsg('Transcrevendo áudio com IA (Whisper)...');
      setProgressPercent(15);

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

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        const errMsg = errData?.error || `HTTP ${response.status}`;

        if (response.status === 401 || errMsg.includes('API key') || errMsg.includes('Incorrect')) {
          throw new Error(
            'API key da OpenAI inválida ou não configurada. ' +
            'Configure a variável OPENAI_API_KEY nas Environment Variables da Vercel.'
          );
        }
        throw new Error(`Erro na transcrição: ${errMsg}`);
      }

      const data = await response.json();
      const words = data.transcription.words as { word: string; startMs: number; endMs: number }[];

      if (words.length === 0) {
        throw new Error('Nenhuma fala detectada no vídeo. O AI CUT precisa de conteúdo falado para funcionar.');
      }

      // Store transcription for TextBasedEditor
      useTranscriptionStore.getState().setTranscription({
        id: data.transcription.id,
        fullText: data.transcription.fullText,
        words: data.transcription.words,
        segments: data.transcription.segments,
      });

      setProgressPercent(50);

      // ── Step 4: Analyze Audio Profile ──
      setProgressMsg('Analisando perfil de áudio...');
      setProgressPercent(55);
      const profile = analyzeAudioProfile(normalized, samplesPerSecond);
      const totalDurationMs = profile.totalDurationMs;

      // ── Step 5: Map Speech Regions (PROTECTED) ──
      setProgressMsg('Mapeando regiões de fala protegidas...');
      setProgressPercent(60);
      const speechRegions = mapSpeechRegions(words, config.paddingMs);

      // Calculate speech duration
      let speechDurationMs = 0;
      for (const sr of speechRegions) {
        speechDurationMs += sr.endMs - sr.startMs;
      }
      speechDurationMs = Math.min(speechDurationMs, totalDurationMs);

      // ── Step 6: Extract Candidate Zones ──
      setProgressMsg('Identificando zonas candidatas...');
      setProgressPercent(65);
      const candidates = extractCandidateZones(speechRegions, totalDurationMs);

      // ── Step 7: Classify All Candidate Zones ──
      setProgressMsg('Classificando silêncios e ruídos...');
      setProgressPercent(70);

      const classified = classifyAllRegions(
        candidates,
        normalized,
        samplesPerSecond,
        profile,
        config.minSilenceMs,
        config.minNoiseMs
      );

      // ── Step 8: Detect Filler Words ──
      setProgressMsg('Detectando filler words...');
      setProgressPercent(85);

      let allRegions: ClassifiedRegion[] = [...classified];

      if (config.includeFillers) {
        const fillers = detectFillerWords(words, classified);
        allRegions = [...allRegions, ...fillers];
      }

      // ── Step 9: Merge and Finalize ──
      setProgressMsg('Gerando cortes otimizados...');
      setProgressPercent(90);

      allRegions = mergeAdjacentRegions(allRegions);
      allRegions.sort((a, b) => a.startMs - b.startMs);

      // Convert to AICutRegion with accepted flag
      const regions: AICutRegion[] = allRegions.map((r) => ({
        ...r,
        accepted: true,
      }));

      setCutRegions(regions);

      // Calculate stats
      const silences = regions.filter((r) => r.type === 'silence');
      const noises = regions.filter((r) => r.type === 'noise');
      const fillers = regions.filter((r) => r.type === 'filler');

      setStats({
        totalDurationMs,
        speechDurationMs,
        speechPercentage: Math.round((speechDurationMs / totalDurationMs) * 100),
        silenceCount: silences.length,
        silenceTotalMs: silences.reduce((s, r) => s + r.durationMs, 0),
        noiseCount: noises.length,
        noiseTotalMs: noises.reduce((s, r) => s + r.durationMs, 0),
        fillerCount: fillers.length,
        fillerTotalMs: fillers.reduce((s, r) => s + r.durationMs, 0),
        totalRemovableMs: regions.reduce((s, r) => s + r.durationMs, 0),
        wordsDetected: words.length,
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

  // ─── Actions ─────────────────────────────────────────────

  const handleCut = useCallback(() => {
    const accepted = cutRegions.filter((r) => r.accepted);
    if (accepted.length === 0) return;

    undo(); // Remove preview marks
    markSilenceRegions(
      accepted.map((r) => ({ startMs: r.startMs, endMs: r.endMs }))
    );
    cutMarkedSilence();
    setCurrentTimeMs(0);
    setPhase('done');
  }, [cutRegions, undo, markSilenceRegions, cutMarkedSilence, setCurrentTimeMs]);

  const handleUndo = useCallback(() => {
    undo();
    setPhase('idle');
    setCutRegions([]);
    setStats(null);
  }, [undo]);

  const toggleRegion = useCallback((index: number) => {
    setCutRegions((prev) =>
      prev.map((r, i) => (i === index ? { ...r, accepted: !r.accepted } : r))
    );
  }, []);

  const toggleCategoryAcceptance = useCallback((type: 'silence' | 'noise' | 'filler', accept: boolean) => {
    setCutRegions((prev) =>
      prev.map((r) => (r.type === type ? { ...r, accepted: accept } : r))
    );
  }, []);

  const acceptAll = useCallback(() => {
    setCutRegions((prev) => prev.map((r) => ({ ...r, accepted: true })));
  }, []);

  const rejectAll = useCallback(() => {
    setCutRegions((prev) => prev.map((r) => ({ ...r, accepted: false })));
  }, []);

  // ─── Render ──────────────────────────────────────────────

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
          AI CUT — Corte Inteligente
        </h3>
      </div>

      {/* ── Phase: Idle ── */}
      {phase === 'idle' && (
        <>
          <p className="text-[10px] text-text-muted leading-relaxed">
            A IA transcreve o vídeo, mapeia toda a fala como{' '}
            <strong>conteúdo protegido</strong>, e identifica <strong>silêncios</strong>{' '}
            e <strong>ruídos ambientais</strong> (motor, latido, vento) para remoção.
            Nenhum conteúdo falado é removido.
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
                'Remove silêncios >800ms e ruídos >500ms. Padding amplo (200ms). Mais seguro.'}
              {aggressiveness === 'balanced' &&
                'Remove silêncios >400ms, ruídos >300ms e fillers. Recomendado.'}
              {aggressiveness === 'aggressive' &&
                'Remove gaps >200ms, ruídos >150ms e fillers. Ritmo rápido.'}
            </p>
          </div>

          {/* Pipeline steps */}
          <div className="p-2 rounded-md bg-bg-surface/50 border border-border-default/30 space-y-1.5">
            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
              <Subtitles size={10} className="text-accent-primary flex-shrink-0" />
              <span>Transcrição completa com Whisper (word-level)</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
              <Shield size={10} className="text-accent-success flex-shrink-0" />
              <span>Proteção de fala — conteúdo nunca é cortado</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
              <VolumeX size={10} className="text-accent-danger flex-shrink-0" />
              <span>Detecção de silêncios entre falas</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
              <AlertTriangle size={10} className="text-accent-warning flex-shrink-0" />
              <span>Detecção de ruídos ambientais (motor, latido, vento)</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-secondary">
              <MessageCircle size={10} className="text-accent-warning flex-shrink-0" />
              <span>Remoção de filler words (é, hm, tipo, né...)</span>
            </div>
          </div>

          <Button className="w-full" size="sm" onClick={handleAnalyze}>
            <Bot size={14} />
            Analisar com IA
          </Button>
        </>
      )}

      {/* ── Phase: Analyzing ── */}
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
            <StepIndicator done={progressPercent >= 10} label="Decodificar áudio" />
            <StepIndicator done={progressPercent >= 50} label="Transcrever com Whisper" />
            <StepIndicator done={progressPercent >= 60} label="Mapear regiões de fala" />
            <StepIndicator done={progressPercent >= 70} label="Classificar silêncios e ruídos" />
            <StepIndicator done={progressPercent >= 85} label="Detectar filler words" />
            <StepIndicator done={progressPercent >= 95} label="Gerar cortes otimizados" />
          </div>
        </div>
      )}

      {/* ── Error ── */}
      {error && (
        <div className="p-2.5 rounded-md bg-accent-danger/10 border border-accent-danger/20 space-y-1.5">
          <p className="text-[11px] text-accent-danger font-medium">{error}</p>
          <button
            onClick={() => { setError(null); setPhase('idle'); }}
            className="text-[10px] text-accent-danger/70 hover:underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Phase: Review ── */}
      {phase === 'review' && (
        <div className="space-y-2">
          {/* Professional Summary */}
          {stats && (
            <div className="p-2.5 rounded-md bg-bg-surface/80 border border-border-default/40 space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-text-secondary font-medium">
                <Wand2 size={12} className="text-accent-primary" />
                Análise Completa
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Mic size={8} className="text-accent-success" />
                  <span>Fala: <span className="text-text-secondary font-mono">{formatDuration(stats.speechDurationMs)}</span> ({stats.speechPercentage}%)</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Subtitles size={8} className="text-accent-primary" />
                  <span>Palavras: <span className="text-text-secondary font-mono">{stats.wordsDetected}</span></span>
                </div>
                <div className="flex items-center gap-1.5 text-text-muted">
                  <VolumeX size={8} className="text-accent-danger" />
                  <span>Silêncios: <span className="text-text-secondary font-mono">{stats.silenceCount}</span> ({formatDuration(stats.silenceTotalMs)})</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-muted">
                  <AlertTriangle size={8} className="text-accent-warning" />
                  <span>Ruídos: <span className="text-text-secondary font-mono">{stats.noiseCount}</span> ({formatDuration(stats.noiseTotalMs)})</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-muted">
                  <MessageCircle size={8} className="text-accent-warning" />
                  <span>Fillers: <span className="text-text-secondary font-mono">{stats.fillerCount}</span> ({formatDuration(stats.fillerTotalMs)})</span>
                </div>
                <div className="flex items-center gap-1.5 text-text-muted">
                  <Scissors size={8} className="text-accent-primary" />
                  <span>Removível: <span className="text-text-secondary font-mono">{formatDuration(stats.totalRemovableMs)}</span></span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1 border-t border-border-default/20">
                <Shield size={9} className="text-accent-success" />
                <span className="text-[9px] text-accent-success">
                  Todo conteúdo falado está protegido
                </span>
              </div>
            </div>
          )}

          {/* Accept/Reject All */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-muted">
              {acceptedRegions.length}/{cutRegions.length} selecionados
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

          {/* ── Silence Regions ── */}
          {silenceRegions.length > 0 && (
            <CategorySection
              title={`Silêncios (${silenceRegions.length})`}
              subtitle={formatDuration(silenceRegions.reduce((s, r) => s + r.durationMs, 0))}
              icon={<VolumeX size={10} className="text-accent-danger" />}
              isOpen={showSilences}
              onToggle={() => setShowSilences(!showSilences)}
              acceptedCount={silenceRegions.filter((r) => r.accepted).length}
              totalCount={silenceRegions.length}
              onAcceptAll={() => toggleCategoryAcceptance('silence', true)}
              onRejectAll={() => toggleCategoryAcceptance('silence', false)}
              colorClass="accent-danger"
            >
              {silenceRegions.map((region) => {
                const globalIdx = cutRegions.indexOf(region);
                return (
                  <RegionRow
                    key={globalIdx}
                    region={region}
                    onToggle={() => toggleRegion(globalIdx)}
                    onPreview={() => setCurrentTimeMs(Math.max(0, region.startMs - 500))}
                    colorClass="accent-danger"
                  />
                );
              })}
            </CategorySection>
          )}

          {/* ── Noise Regions ── */}
          {noiseRegions.length > 0 && (
            <CategorySection
              title={`Ruídos (${noiseRegions.length})`}
              subtitle={formatDuration(noiseRegions.reduce((s, r) => s + r.durationMs, 0))}
              icon={<AlertTriangle size={10} className="text-accent-warning" />}
              isOpen={showNoises}
              onToggle={() => setShowNoises(!showNoises)}
              acceptedCount={noiseRegions.filter((r) => r.accepted).length}
              totalCount={noiseRegions.length}
              onAcceptAll={() => toggleCategoryAcceptance('noise', true)}
              onRejectAll={() => toggleCategoryAcceptance('noise', false)}
              colorClass="accent-warning"
            >
              {noiseRegions.map((region) => {
                const globalIdx = cutRegions.indexOf(region);
                return (
                  <RegionRow
                    key={globalIdx}
                    region={region}
                    onToggle={() => toggleRegion(globalIdx)}
                    onPreview={() => setCurrentTimeMs(Math.max(0, region.startMs - 500))}
                    colorClass="accent-warning"
                  />
                );
              })}
            </CategorySection>
          )}

          {/* ── Filler Regions ── */}
          {fillerRegions.length > 0 && (
            <CategorySection
              title={`Filler Words (${fillerRegions.length})`}
              subtitle={formatDuration(fillerRegions.reduce((s, r) => s + r.durationMs, 0))}
              icon={<MessageCircle size={10} className="text-accent-warning" />}
              isOpen={showFillers}
              onToggle={() => setShowFillers(!showFillers)}
              acceptedCount={fillerRegions.filter((r) => r.accepted).length}
              totalCount={fillerRegions.length}
              onAcceptAll={() => toggleCategoryAcceptance('filler', true)}
              onRejectAll={() => toggleCategoryAcceptance('filler', false)}
              colorClass="accent-warning"
            >
              {fillerRegions.map((region) => {
                const globalIdx = cutRegions.indexOf(region);
                return (
                  <RegionRow
                    key={globalIdx}
                    region={region}
                    onToggle={() => toggleRegion(globalIdx)}
                    onPreview={() => setCurrentTimeMs(Math.max(0, region.startMs - 500))}
                    colorClass="accent-warning"
                  />
                );
              })}
            </CategorySection>
          )}

          {/* No regions found */}
          {cutRegions.length === 0 && (
            <div className="p-3 rounded-md bg-accent-success/10 border border-accent-success/20 text-center">
              <p className="text-xs text-accent-success">
                Nenhum silêncio ou ruído significativo encontrado.
              </p>
              <p className="text-[9px] text-text-muted mt-1">
                O vídeo está limpo! Tente o modo &quot;Agressivo&quot; para detectar gaps menores.
              </p>
            </div>
          )}

          {/* Action buttons */}
          {cutRegions.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <Button
                className="w-full"
                size="sm"
                variant="danger"
                disabled={acceptedRegions.length === 0}
                onClick={handleCut}
              >
                <Scissors size={14} />
                AI CUT — Aplicar {acceptedRegions.length} cortes ({formatDuration(totalCutMs)})
              </Button>

              <button
                onClick={handleUndo}
                className="w-full text-[10px] text-text-muted hover:text-text-secondary py-1 hover:underline"
              >
                Cancelar e voltar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Phase: Done ── */}
      {phase === 'done' && (
        <div className="space-y-2">
          <div className="p-2.5 rounded-md bg-accent-success/10 border border-accent-success/20 text-center">
            <p className="text-xs text-accent-success font-medium">
              AI CUT aplicado com sucesso!
            </p>
            <p className="text-[10px] text-text-muted mt-1">
              {acceptedRegions.length} cortes realizados — {formatDuration(totalCutMs)} removidos
            </p>
            {stats && (
              <p className="text-[9px] text-text-muted mt-0.5">
                Fala protegida: {formatDuration(stats.speechDurationMs)} ({stats.speechPercentage}% do original)
              </p>
            )}
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
                setStats(null);
              }}
            >
              Novo corte
            </Button>
          </div>
        </div>
      )}

      {/* Hint */}
      {phase === 'idle' && !error && (
        <p className="text-center text-[9px] text-text-muted py-1 leading-relaxed">
          Requer API key da OpenAI configurada na Vercel.
          A transcrição garante que nenhum conteúdo falado seja removido.
        </p>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function StepIndicator({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-1.5 h-1.5 rounded-full ${done ? 'bg-accent-success' : 'bg-text-muted/30'}`} />
      {label}
    </div>
  );
}

function CategorySection({
  title,
  subtitle,
  icon,
  isOpen,
  onToggle,
  acceptedCount,
  totalCount,
  onAcceptAll,
  onRejectAll,
  colorClass,
  children,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  acceptedCount: number;
  totalCount: number;
  onAcceptAll: () => void;
  onRejectAll: () => void;
  colorClass: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-md border border-${colorClass}/15 overflow-hidden`}>
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 p-2 bg-${colorClass}/5 hover:bg-${colorClass}/8 transition-colors`}
      >
        {icon}
        <span className="text-[10px] font-medium text-text-secondary flex-1 text-left">
          {title}
        </span>
        <span className="text-[9px] text-text-muted font-mono">{subtitle}</span>
        <span className="text-[9px] text-text-muted ml-1">
          ({acceptedCount}/{totalCount})
        </span>
        {isOpen ? <ChevronUp size={11} className="text-text-muted" /> : <ChevronDown size={11} className="text-text-muted" />}
      </button>

      {isOpen && (
        <div className="border-t border-border-default/20">
          <div className="flex justify-end gap-1 px-2 py-1 bg-bg-surface/30">
            <button onClick={onAcceptAll} className="text-[9px] text-accent-success hover:underline">
              Aceitar todos
            </button>
            <span className="text-text-muted text-[9px]">|</span>
            <button onClick={onRejectAll} className="text-[9px] text-accent-danger hover:underline">
              Rejeitar todos
            </button>
          </div>
          <div className="max-h-36 overflow-y-auto space-y-0.5 p-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

function RegionRow({
  region,
  onToggle,
  onPreview,
  colorClass,
}: {
  region: AICutRegion;
  onToggle: () => void;
  onPreview: () => void;
  colorClass: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 p-1.5 rounded text-[10px] transition-colors ${
        region.accepted
          ? `bg-${colorClass}/8`
          : 'bg-bg-surface opacity-40'
      }`}
    >
      <button
        onClick={onToggle}
        className={`p-0.5 rounded flex-shrink-0 ${
          region.accepted ? `text-${colorClass}` : 'text-text-muted'
        }`}
      >
        {region.accepted ? <Check size={11} /> : <X size={11} />}
      </button>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-text-muted">
          {formatDuration(region.startMs)} — {formatDuration(region.endMs)}
        </span>
        <span className="text-text-muted/50 ml-1">
          ({(region.durationMs / 1000).toFixed(1)}s)
        </span>
        <p className="text-[9px] text-text-muted/70 truncate">{region.label}</p>
      </div>
      {region.noiseType && (
        <span className={`text-[8px] px-1 py-0.5 rounded bg-${colorClass}/10 text-${colorClass}`}>
          {region.noiseType === 'continuous' ? 'CONT' : region.noiseType === 'impulsive' ? 'IMP' : 'AMB'}
        </span>
      )}
      <button
        onClick={onPreview}
        className="p-0.5 rounded hover:bg-bg-hover text-text-muted hover:text-text-secondary flex-shrink-0"
      >
        <Play size={9} />
      </button>
    </div>
  );
}
