'use client';

import { Monitor, Type, Sliders } from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { ASPECT_RATIOS, type AspectRatioKey } from '@/lib/constants';
import { AspectRatioSelector } from './AspectRatioSelector';
import { formatDuration } from '@/lib/utils';

export function PropertiesPanel() {
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const aspectRatio = useEditorStore((s) => s.aspectRatio);

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border-default/60">
        <h3 className="text-xs font-medium text-text-secondary">Propriedades</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {selectedClipId ? (
          <ClipProperties clipId={selectedClipId} />
        ) : (
          <ProjectProperties aspectRatio={aspectRatio} />
        )}
      </div>
    </div>
  );
}

function ProjectProperties({ aspectRatio }: { aspectRatio: AspectRatioKey }) {
  const ratioConfig = ASPECT_RATIOS[aspectRatio];

  return (
    <div className="space-y-4">
      <div>
        <label className="flex items-center gap-2 text-[10px] font-medium text-text-muted mb-2 uppercase tracking-wider">
          <Monitor size={12} />
          Proporção de Tela
        </label>
        <AspectRatioSelector />
      </div>

      <div className="p-3 rounded-md bg-bg-surface border border-border-default/40">
        <p className="text-[10px] text-text-muted mb-1">Resolução</p>
        <p className="text-xs font-mono text-text-secondary">
          {ratioConfig.width} x {ratioConfig.height}
        </p>
      </div>

      <div className="p-3 rounded-md bg-bg-surface border border-border-default/40">
        <p className="text-[10px] text-text-muted mb-1">Plataforma</p>
        <p className="text-xs text-text-secondary">{ratioConfig.label}</p>
      </div>
    </div>
  );
}

function ClipProperties({ clipId }: { clipId: string }) {
  const findClipById = useTimelineStore((s) => s.findClipById);
  const updateClip = useTimelineStore((s) => s.updateClip);

  const result = findClipById(clipId);
  if (!result) {
    return (
      <div className="text-[10px] text-text-muted p-3">
        Clip não encontrado.
      </div>
    );
  }

  const { track, clip } = result;
  const speed = clip.properties.speed ?? 1;
  const volume = clip.properties.volume ?? 1;
  const opacity = clip.properties.opacity ?? 1;

  const handleSpeedChange = (value: number) => {
    updateClip(track.id, clip.id, {
      properties: { ...clip.properties, speed: value },
    });
  };

  const handleVolumeChange = (value: number) => {
    updateClip(track.id, clip.id, {
      properties: { ...clip.properties, volume: value / 100 },
    });
  };

  const handleOpacityChange = (value: number) => {
    updateClip(track.id, clip.id, {
      properties: { ...clip.properties, opacity: value / 100 },
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-[10px] font-medium text-text-muted uppercase tracking-wider">
        <Sliders size={12} />
        Clip selecionado
      </div>

      {/* Timing info */}
      <div className="p-3 rounded-md bg-bg-surface border border-border-default/40 space-y-1">
        <div className="flex justify-between text-[10px]">
          <span className="text-text-muted">Início</span>
          <span className="text-text-secondary font-mono">{formatDuration(clip.startTimeMs)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-text-muted">Fim</span>
          <span className="text-text-secondary font-mono">{formatDuration(clip.endTimeMs)}</span>
        </div>
        <div className="flex justify-between text-[10px]">
          <span className="text-text-muted">Duração</span>
          <span className="text-text-secondary font-mono">{formatDuration(clip.endTimeMs - clip.startTimeMs)}</span>
        </div>
      </div>

      {/* Speed slider */}
      <div>
        <label className="text-[10px] font-medium text-text-muted mb-2 flex items-center gap-2 uppercase tracking-wider">
          <Type size={12} />
          Velocidade
        </label>
        <input
          type="range"
          min={0.25}
          max={4}
          step={0.25}
          value={speed}
          onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-text-muted mt-1">
          <span>0.25x</span>
          <span className="text-text-secondary">{speed}x</span>
          <span>4x</span>
        </div>
      </div>

      {/* Volume slider */}
      <div>
        <label className="text-[10px] font-medium text-text-muted mb-2 block uppercase tracking-wider">
          Volume
        </label>
        <input
          type="range"
          min={0}
          max={200}
          value={Math.round(volume * 100)}
          onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-text-muted mt-1">
          <span>0%</span>
          <span className="text-text-secondary">{Math.round(volume * 100)}%</span>
          <span>200%</span>
        </div>
      </div>

      {/* Opacity slider */}
      <div>
        <label className="text-[10px] font-medium text-text-muted mb-2 block uppercase tracking-wider">
          Opacidade
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-text-muted mt-1">
          <span>0%</span>
          <span className="text-text-secondary">{Math.round(opacity * 100)}%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}
