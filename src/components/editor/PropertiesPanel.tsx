'use client';

import { Monitor, Type, Sliders } from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { ASPECT_RATIOS, type AspectRatioKey } from '@/lib/constants';
import { AspectRatioSelector } from './AspectRatioSelector';

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
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[10px] font-medium text-text-muted uppercase tracking-wider">
        <Sliders size={12} />
        Clip selecionado
      </div>
      <div className="p-3 rounded-md bg-bg-surface border border-border-default/40">
        <p className="text-[10px] text-text-muted mb-1">ID</p>
        <p className="text-[10px] font-mono truncate text-text-secondary">{clipId}</p>
      </div>

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
          defaultValue={1}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-text-muted mt-1">
          <span>0.25x</span>
          <span>1x</span>
          <span>4x</span>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium text-text-muted mb-2 block uppercase tracking-wider">
          Volume
        </label>
        <input
          type="range"
          min={0}
          max={200}
          defaultValue={100}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-text-muted mt-1">
          <span>0%</span>
          <span>100%</span>
          <span>200%</span>
        </div>
      </div>
    </div>
  );
}
