'use client';

import { useAudioStore } from '@/stores/useAudioStore';
import { Button } from '@/components/ui/Button';
import { formatDuration } from '@/lib/utils';
import { Scissors, Check, X, Settings2 } from 'lucide-react';

export function SilenceCutPanel() {
  const {
    silenceRegions,
    isAnalyzing,
    thresholdDb,
    minDurationMs,
    paddingMs,
    removeFillerWords,
    setThresholdDb,
    setMinDurationMs,
    setPaddingMs,
    setRemoveFillerWords,
    toggleSilenceRegion,
    acceptAllRegions,
    rejectAllRegions,
  } = useAudioStore();

  const acceptedCount = silenceRegions.filter((r) => r.accepted).length;

  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center gap-2">
        <Scissors size={16} className="text-accent-primary" />
        <h3 className="text-sm font-semibold">Corte de Silêncio</h3>
      </div>

      {/* Settings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <Settings2 size={12} />
          Configurações
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">
            Threshold ({thresholdDb} dB)
          </label>
          <input
            type="range"
            min={-60}
            max={-10}
            value={thresholdDb}
            onChange={(e) => setThresholdDb(Number(e.target.value))}
            className="w-full"
          />
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">
            Duração mínima ({minDurationMs}ms)
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
        </div>

        <div>
          <label className="text-xs text-text-muted block mb-1">
            Padding ({paddingMs}ms)
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
        </div>

        <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={removeFillerWords}
            onChange={(e) => setRemoveFillerWords(e.target.checked)}
            className="rounded border-border-default"
          />
          Remover filler words (um, é, tipo, né...)
        </label>
      </div>

      {/* Analyze Button */}
      <Button className="w-full" isLoading={isAnalyzing}>
        <Scissors size={14} />
        Detectar Silêncios
      </Button>

      {/* Results */}
      {silenceRegions.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-secondary">
              {silenceRegions.length} regiões encontradas ({acceptedCount}{' '}
              selecionadas)
            </span>
            <div className="flex gap-1">
              <button
                onClick={acceptAllRegions}
                className="text-xs text-accent-success hover:underline"
              >
                Aceitar todos
              </button>
              <span className="text-text-muted">|</span>
              <button
                onClick={rejectAllRegions}
                className="text-xs text-accent-danger hover:underline"
              >
                Rejeitar todos
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-1">
            {silenceRegions.map((region, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-colors ${
                  region.accepted
                    ? 'bg-accent-danger/10 border border-accent-danger/20'
                    : 'bg-bg-surface'
                }`}
              >
                <button
                  onClick={() => toggleSilenceRegion(i)}
                  className={`p-0.5 rounded ${
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
                <span className="font-mono text-text-muted">
                  {formatDuration(region.startMs)} -{' '}
                  {formatDuration(region.endMs)}
                </span>
                <span className="text-text-muted ml-auto capitalize">
                  {region.type}
                </span>
              </div>
            ))}
          </div>

          <Button className="w-full" variant="danger" disabled={acceptedCount === 0}>
            Aplicar Cortes ({acceptedCount})
          </Button>
        </div>
      )}
    </div>
  );
}
