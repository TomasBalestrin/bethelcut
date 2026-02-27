'use client';

import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Undo2,
  Redo2,
  Scissors,
  Trash2,
  Copy,
  SplitSquareHorizontal,
  ZoomIn,
  ZoomOut,
  Magnet,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Download,
} from 'lucide-react';
import { useEditorStore } from '@/stores/useEditorStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { useTimelineStore } from '@/stores/useTimelineStore';
import { Logo } from '@/components/shared/Logo';
import { EDITOR_CONFIG } from '@/lib/constants';

export function Toolbar() {
  const router = useRouter();
  const leftPanelOpen = useEditorStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useEditorStore((s) => s.rightPanelOpen);
  const toggleLeftPanel = useEditorStore((s) => s.toggleLeftPanel);
  const toggleRightPanel = useEditorStore((s) => s.toggleRightPanel);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const currentProject = useProjectStore((s) => s.currentProject);
  const isSaving = useProjectStore((s) => s.isSaving);
  const magnetEnabled = useTimelineStore((s) => s.magnetEnabled);
  const toggleMagnet = useTimelineStore((s) => s.toggleMagnet);

  const toolbarButtons = [
    { icon: Undo2, label: 'Desfazer (Ctrl+Z)', action: () => {} },
    { icon: Redo2, label: 'Refazer (Ctrl+Shift+Z)', action: () => {} },
    { divider: true },
    { icon: Scissors, label: 'Cortar (B)', action: () => {} },
    { icon: Trash2, label: 'Excluir (Del)', action: () => {} },
    { icon: Copy, label: 'Duplicar', action: () => {} },
    { icon: SplitSquareHorizontal, label: 'Dividir', action: () => {} },
  ];

  return (
    <div
      className="flex items-center justify-between px-3 border-b border-border-default bg-bg-secondary flex-shrink-0"
      style={{ height: EDITOR_CONFIG.TOOLBAR_HEIGHT }}
    >
      {/* Left: Back + Logo + Project Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/projects')}
          className="p-1.5 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
          title="Voltar aos projetos"
        >
          <ArrowLeft size={18} />
        </button>
        <Logo size="sm" />
        <div className="h-5 w-px bg-border-default" />
        <span className="text-sm text-text-secondary truncate max-w-[200px]">
          {currentProject?.name || 'Projeto'}
        </span>
        {isSaving && (
          <span className="text-xs text-text-muted animate-pulse">
            Salvando...
          </span>
        )}
      </div>

      {/* Center: Tools */}
      <div className="flex items-center gap-0.5">
        {toolbarButtons.map((btn, i) =>
          'divider' in btn ? (
            <div key={i} className="h-5 w-px bg-border-default mx-1" />
          ) : (
            <button
              key={i}
              onClick={btn.action}
              title={btn.label}
              className="p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
            >
              <btn.icon size={16} />
            </button>
          )
        )}

        <div className="h-5 w-px bg-border-default mx-1" />

        {/* Magnet */}
        <button
          onClick={toggleMagnet}
          title="Snap magnético"
          className={`p-2 rounded-lg transition-colors ${
            magnetEnabled
              ? 'bg-accent-primary/20 text-accent-primary'
              : 'hover:bg-bg-hover text-text-secondary hover:text-text-primary'
          }`}
        >
          <Magnet size={16} />
        </button>

        <div className="h-5 w-px bg-border-default mx-1" />

        {/* Zoom */}
        <button
          onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
          title="Diminuir zoom"
        >
          <ZoomOut size={16} />
        </button>
        <span className="text-xs text-text-muted w-10 text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(Math.min(4, zoom + 0.25))}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
          title="Aumentar zoom"
        >
          <ZoomIn size={16} />
        </button>
      </div>

      {/* Right: Panels + Save + Export */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleLeftPanel}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
          title={leftPanelOpen ? 'Fechar painel esquerdo' : 'Abrir painel esquerdo'}
        >
          {leftPanelOpen ? (
            <PanelLeftClose size={16} />
          ) : (
            <PanelLeftOpen size={16} />
          )}
        </button>
        <button
          onClick={toggleRightPanel}
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
          title={rightPanelOpen ? 'Fechar painel direito' : 'Abrir painel direito'}
        >
          {rightPanelOpen ? (
            <PanelRightClose size={16} />
          ) : (
            <PanelRightOpen size={16} />
          )}
        </button>

        <div className="h-5 w-px bg-border-default mx-1" />

        <button
          className="p-2 rounded-lg hover:bg-bg-hover transition-colors text-text-secondary hover:text-text-primary"
          title="Salvar (Ctrl+S)"
        >
          <Save size={16} />
        </button>

        <button className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-primary hover:bg-blue-600 text-white text-sm font-medium transition-colors">
          <Download size={14} />
          Exportar
        </button>
      </div>
    </div>
  );
}
