'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Subtitles,
  Scissors,
  Trash2,
  Search,
  Loader2,
  AlertCircle,
  Filter,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTranscriptionStore } from '@/stores/useTranscriptionStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { formatDuration } from '@/lib/utils';
import { decodeAudioFromVideo } from '@/lib/audio/waveform';
import { encodeAudioBufferToWav } from '@/lib/audio/wav-encoder';

type Phase = 'idle' | 'transcribing' | 'editing';

export function TextBasedEditor() {
  const mediaAssets = useProjectStore((s) => s.mediaAssets);
  const currentProject = useProjectStore((s) => s.currentProject);
  const tracks = useTimelineStore((s) => s.tracks);
  const markSilenceRegions = useTimelineStore((s) => s.markSilenceRegions);
  const cutMarkedSilence = useTimelineStore((s) => s.cutMarkedSilence);
  const undo = useTimelineStore((s) => s.undo);
  const setCurrentTimeMs = useEditorStore((s) => s.setCurrentTimeMs);

  const {
    words,
    isTranscribing,
    error,
    selectedWordIndices,
    fillerWordIndices,
    pauseRegions,
    minPauseDurationMs,
    setTranscription,
    setIsTranscribing,
    setError,
    toggleWordSelection,
    selectWordRange,
    clearSelection,
    selectAllFillerWords,
    setMinPauseDurationMs,
    getSelectedRegions,
  } = useTranscriptionStore();

  const [phase, setPhase] = useState<Phase>(words.length > 0 ? 'editing' : 'idle');
  const [progressMsg, setProgressMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const lastClickedIndexRef = useRef<number | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const videoAsset = mediaAssets.find((a) => a.type === 'video');
  const videoTrack = tracks.find((t) => t.type === 'video');
  const hasClips = videoTrack && videoTrack.clips.length > 0;

  // Sync phase with transcription state
  useEffect(() => {
    if (words.length > 0) setPhase('editing');
  }, [words.length]);

  const handleTranscribe = useCallback(async () => {
    if (!videoAsset || !currentProject) return;

    setError(null);
    setIsTranscribing(true);
    setPhase('transcribing');

    try {
      // Step 1: Extract audio client-side (avoids 25MB video limit on Whisper)
      setProgressMsg('Extraindo áudio do vídeo...');
      const audioBuffer = await decodeAudioFromVideo(videoAsset.fileUrl);

      // Step 2: Encode as 16kHz mono WAV (much smaller than full video)
      setProgressMsg('Codificando áudio...');
      const wavBlob = encodeAudioBufferToWav(audioBuffer);

      // Step 3: Send audio + metadata as FormData
      setProgressMsg('Enviando para transcrição...');
      const formData = new FormData();
      formData.append('audio', wavBlob, 'audio.wav');
      formData.append('assetId', videoAsset.id);
      formData.append('projectId', currentProject.id);
      formData.append('language', 'pt');

      const response = await fetch('/api/transcription', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro na transcrição');
      }

      setTranscription({
        id: data.transcription.id,
        fullText: data.transcription.fullText,
        words: data.transcription.words,
        segments: data.transcription.segments,
      });

      setPhase('editing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro na transcrição');
      setPhase('idle');
    } finally {
      setIsTranscribing(false);
      setProgressMsg('');
    }
  }, [videoAsset, currentProject, setError, setIsTranscribing, setTranscription]);

  const handleWordClick = useCallback(
    (index: number, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedIndexRef.current !== null) {
        selectWordRange(lastClickedIndexRef.current, index);
      } else {
        toggleWordSelection(index);
      }
      lastClickedIndexRef.current = index;
    },
    [toggleWordSelection, selectWordRange]
  );

  const handleSeekToWord = useCallback(
    (index: number) => {
      if (words[index]) {
        setCurrentTimeMs(words[index].startMs);
      }
    },
    [words, setCurrentTimeMs]
  );

  const handleDeleteSelected = useCallback(() => {
    const regions = getSelectedRegions();
    if (regions.length === 0) return;

    markSilenceRegions(regions);
    cutMarkedSilence();
    clearSelection();
  }, [getSelectedRegions, markSilenceRegions, cutMarkedSilence, clearSelection]);

  const handleDeleteFillerWords = useCallback(() => {
    selectAllFillerWords();
    // We need a tick for the state to update, then cut
    setTimeout(() => {
      const regions = useTranscriptionStore.getState().getSelectedRegions();
      if (regions.length === 0) return;
      markSilenceRegions(regions);
      cutMarkedSilence();
      useTranscriptionStore.getState().clearSelection();
    }, 0);
  }, [selectAllFillerWords, markSilenceRegions, cutMarkedSilence]);

  const handleDeletePauses = useCallback(() => {
    if (pauseRegions.length === 0) return;
    const regions = pauseRegions.map((p) => ({
      startMs: p.startMs,
      endMs: p.endMs,
    }));
    markSilenceRegions(regions);
    cutMarkedSilence();
  }, [pauseRegions, markSilenceRegions, cutMarkedSilence]);

  // Current playback word highlighting
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const activeWordIndex = words.findIndex(
    (w) => currentTimeMs >= w.startMs && currentTimeMs <= w.endMs
  );

  // Search matching
  const searchLower = searchQuery.toLowerCase();
  const searchMatchIndices = searchQuery
    ? words
        .map((w, i) => (w.word.toLowerCase().includes(searchLower) ? i : -1))
        .filter((i) => i !== -1)
    : [];

  if (!videoAsset || !hasClips) {
    return (
      <div className="text-center py-8">
        <Subtitles size={28} className="text-text-muted/40 mx-auto mb-3" />
        <p className="text-xs text-text-secondary">Edição por Texto</p>
        <p className="text-[10px] text-text-muted mt-1">
          Importe um vídeo para transcrever e editar por texto
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Subtitles size={14} className="text-accent-primary" />
        <h3 className="text-xs font-medium text-text-secondary">
          Edição por Texto
        </h3>
      </div>

      {/* Phase: Idle - transcribe button */}
      {phase === 'idle' && (
        <>
          <p className="text-[10px] text-text-muted leading-relaxed">
            Transcreve o áudio do vídeo usando IA (OpenAI Whisper).
            Após a transcrição, você pode editar o vídeo deletando
            texto — como no Adobe Premiere.
          </p>
          <Button
            className="w-full"
            size="sm"
            onClick={handleTranscribe}
            isLoading={isTranscribing}
          >
            <Subtitles size={14} />
            Transcrever Vídeo
          </Button>
        </>
      )}

      {/* Phase: Transcribing */}
      {phase === 'transcribing' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Loader2 size={24} className="text-accent-primary animate-spin" />
          <p className="text-xs text-text-secondary">{progressMsg || 'Transcrevendo áudio...'}</p>
          <p className="text-[10px] text-text-muted">
            Isso pode levar alguns minutos dependendo do tamanho do vídeo
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 rounded-md bg-accent-danger/10 border border-accent-danger/20">
          <div className="flex items-center gap-1.5">
            <AlertCircle size={12} className="text-accent-danger flex-shrink-0" />
            <p className="text-xs text-accent-danger">{error}</p>
          </div>
          <button
            onClick={() => { setError(null); setPhase('idle'); }}
            className="text-[10px] text-accent-danger/70 hover:underline mt-1"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Phase: Editing */}
      {phase === 'editing' && words.length > 0 && (
        <>
          {/* Toolbar */}
          <div className="space-y-2">
            {/* Search */}
            <div className="relative">
              <Search
                size={12}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                placeholder="Buscar no texto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-bg-surface border border-border-default/40 rounded-md text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/40"
              />
              {searchQuery && searchMatchIndices.length > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-text-muted">
                  {searchMatchIndices.length} resultados
                </span>
              )}
            </div>

            {/* Quick actions */}
            <div className="flex gap-1">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${
                  showFilters
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : 'bg-bg-surface text-text-muted hover:text-text-secondary'
                }`}
              >
                <Filter size={10} />
                Filtros
              </button>
              <button
                onClick={handleDeleteFillerWords}
                disabled={fillerWordIndices.length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-bg-surface text-text-muted hover:text-text-secondary disabled:opacity-40 transition-colors"
                title={`Remover ${fillerWordIndices.length} filler words`}
              >
                <Trash2 size={10} />
                Fillers ({fillerWordIndices.length})
              </button>
              <button
                onClick={handleDeletePauses}
                disabled={pauseRegions.length === 0}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] bg-bg-surface text-text-muted hover:text-text-secondary disabled:opacity-40 transition-colors"
                title={`Remover ${pauseRegions.length} pausas`}
              >
                <Clock size={10} />
                Pausas ({pauseRegions.length})
              </button>
            </div>

            {/* Filters panel */}
            {showFilters && (
              <div className="p-2 rounded-md bg-bg-surface border border-border-default/40 space-y-2">
                <div>
                  <label className="text-[10px] text-text-muted">
                    Duração mín. de pausa: <span className="text-text-secondary font-mono">{minPauseDurationMs}ms</span>
                  </label>
                  <input
                    type="range"
                    min={200}
                    max={3000}
                    step={100}
                    value={minPauseDurationMs}
                    onChange={(e) => setMinPauseDurationMs(Number(e.target.value))}
                    className="w-full"
                  />
                </div>
                <p className="text-[9px] text-text-muted">
                  Filler words PT-BR: é, hm, um, tipo, né, então, assim...
                </p>
              </div>
            )}

            {/* Selection info */}
            {selectedWordIndices.size > 0 && (
              <div className="flex items-center justify-between p-1.5 rounded-md bg-accent-primary/8 border border-accent-primary/15">
                <span className="text-[10px] text-accent-primary">
                  {selectedWordIndices.size} palavras selecionadas
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={handleDeleteSelected}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-accent-danger/10 text-accent-danger hover:bg-accent-danger/20 transition-colors"
                  >
                    <Scissors size={10} />
                    Cortar
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-2 py-0.5 rounded text-[10px] text-text-muted hover:text-text-secondary"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Transcript text */}
          <div
            ref={transcriptRef}
            className="max-h-[400px] overflow-y-auto p-2 rounded-md bg-bg-surface/50 border border-border-default/30 leading-relaxed select-none"
          >
            <div className="flex flex-wrap gap-y-1">
              {words.map((word, i) => {
                const isSelected = selectedWordIndices.has(i);
                const isActive = i === activeWordIndex;
                const isFiller = fillerWordIndices.includes(i);
                const isSearchMatch = searchMatchIndices.includes(i);

                return (
                  <span
                    key={i}
                    onClick={(e) => handleWordClick(i, e)}
                    onDoubleClick={() => handleSeekToWord(i)}
                    className={`
                      inline-block px-0.5 py-0.5 rounded cursor-pointer text-[11px] leading-tight transition-colors
                      ${isSelected
                        ? 'bg-accent-danger/20 text-accent-danger line-through'
                        : isActive
                        ? 'bg-accent-primary/20 text-accent-primary font-medium'
                        : isSearchMatch
                        ? 'bg-accent-warning/15 text-accent-warning'
                        : isFiller
                        ? 'text-accent-warning/70'
                        : 'text-text-secondary hover:bg-bg-hover'
                      }
                    `}
                    title={`${formatDuration(word.startMs)} - ${formatDuration(word.endMs)}`}
                  >
                    {word.word}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-[9px] text-text-muted">
            <span>{words.length} palavras</span>
            <span>{fillerWordIndices.length} fillers detectados</span>
            <span>{pauseRegions.length} pausas</span>
          </div>

          {/* Help */}
          <div className="p-2 rounded-md bg-bg-surface/30 border border-border-default/20">
            <p className="text-[9px] text-text-muted leading-relaxed">
              <strong>Clique</strong> para selecionar palavras.{' '}
              <strong>Shift+clique</strong> para selecionar intervalo.{' '}
              <strong>Duplo clique</strong> para navegar.{' '}
              <strong>Cortar</strong> remove do vídeo. <strong>Ctrl+Z</strong> desfaz.
            </p>
          </div>

          {/* Undo + Re-transcribe */}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              size="sm"
              variant="secondary"
              onClick={() => undo()}
            >
              Desfazer último corte
            </Button>
            <Button
              className="flex-1"
              size="sm"
              variant="ghost"
              onClick={() => { setPhase('idle'); }}
            >
              Re-transcrever
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
