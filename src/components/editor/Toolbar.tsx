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
  const currentTimeMs = useEditorStore((s) => s.currentTimeMs);
  const selectedClipId = useEditorStore((s) => s.selectedClipId);
  const setSelectedClipId = useEditorStore((s) => s.setSelectedClipId);
  const currentProject = useProjectStore((s) => s.currentProject);
  const isSaving = useProjectStore((s) => s.isSaving);
  const magnetEnabled = useTimelineStore((s) => s.magnetEnabled);
  const toggleMagnet = useTimelineStore((s) => s.toggleMagnet);
  const splitClipAtPlayhead = useTimelineStore((s) => s.splitClipAtPlayhead);
  const removeClipById = useTimelineStore((s) => s.removeClipById);
  const undo = useTimelineStore((s) => s.undo);
  const redo = useTimelineStore((s) => s.redo);

  const toolbarButtons = [
    { icon: Undo2, label: 'Desfazer (Ctrl+Z)', action: () => undo() },
    { icon: Redo2, label: 'Refazer (Ctrl+Shift+Z)', action: () => redo() },
    { divider: true },
    { icon: Scissors, label: 'Cortar (B)', action: () => splitClipAtPlayhead(currentTimeMs) },
    {
      icon: Trash2,
      label: 'Excluir (Del)',
      action: () => {
        if (selectedClipId) {
          removeClipById(selectedClipId);
          setSelectedClipId(null);
        }
      },
    },
    { icon: Copy, label: 'Duplicar', action: () => {} },
    { icon: SplitSquareHorizontal, label: 'Dividir', action: () => splitClipAtPlayhead(currentTimeMs) },
  ];

  return (
    <div
      className="flex items-center justify-between px-3 border-b border-border-default/60 bg-bg-secondary flex-shrink-0"
      style={{ height: EDITOR_CONFIG.TOOLBAR_HEIGHT }}
    >
      {/* Left: Back + Logo + Project Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/projects')}
          className="p-1.5 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
          title="Voltar aos projetos"
        >
          <ArrowLeft size={16} />
        </button>
        <Logo size="sm" />
        <div className="h-4 w-px bg-border-default/60" />
        <span className="text-xs text-text-muted truncate max-w-[200px]">
          {currentProject?.name || 'Projeto'}
        </span>
        {isSaving && (
          <span className="text-[10px] text-text-muted animate-pulse">
            Salvando...
          </span>
        )}
      </div>

      {/* Center: Tools */}
      <div className="flex items-center gap-0.5">
        {toolbarButtons.map((btn, i) =>
          'divider' in btn ? (
            <div key={i} className="h-4 w-px bg-border-default/60 mx-1" />
          ) : (
            <button
              key={i}
              onClick={btn.action}
              title={btn.label}
              className="p-2 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
            >
              <btn.icon size={15} />
            </button>
          )
        )}

        <div className="h-4 w-px bg-border-default/60 mx-1" />

        {/* Magnet */}
        <button
          onClick={toggleMagnet}
          title="Snap magnético"
          className={`p-2 rounded-md transition-colors ${
            magnetEnabled
              ? 'bg-accent-primary/10 text-accent-primary'
              : 'hover:bg-bg-hover text-text-muted hover:text-text-secondary'
          }`}
        >
          <Magnet size={15} />
        </button>

        <div className="h-4 w-px bg-border-default/60 mx-1" />

        {/* Zoom */}
        <button
          onClick={() => setZoom(Math.max(0.25, zoom - 0.25))}
          className="p-2 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
          title="Diminuir zoom"
        >
          <ZoomOut size={15} />
        </button>
        <span className="text-[10px] text-text-muted w-10 text-center font-mono">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(Math.min(4, zoom + 0.25))}
          className="p-2 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
          title="Aumentar zoom"
        >
          <ZoomIn size={15} />
        </button>
      </div>

      {/* Right: Panels + Save + Export */}
      <div className="flex items-center gap-1">
        <button
          onClick={toggleLeftPanel}
          className="p-2 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
          title={leftPanelOpen ? 'Fechar painel esquerdo' : 'Abrir painel esquerdo'}
        >
          {leftPanelOpen ? (
            <PanelLeftClose size={15} />
          ) : (
            <PanelLeftOpen size={15} />
          )}
        </button>
        <button
          onClick={toggleRightPanel}
          className="p-2 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
          title={rightPanelOpen ? 'Fechar painel direito' : 'Abrir painel direito'}
        >
          {rightPanelOpen ? (
            <PanelRightClose size={15} />
          ) : (
            <PanelRightOpen size={15} />
          )}
        </button>

        <div className="h-4 w-px bg-border-default/60 mx-1" />

        <button
          className="p-2 rounded-md hover:bg-bg-hover transition-colors text-text-muted hover:text-text-secondary"
          title="Salvar (Ctrl+S)"
        >
          <Save size={15} />
        </button>

        <button className="ml-2 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent-primary hover:bg-accent-secondary text-white text-xs font-medium transition-colors">
          <Download size={13} />
          Exportar
        </button>
      </div>
    </div>
  );
}
