'use client';

import { useCaptionStore } from '@/stores/useCaptionStore';
import { CAPTION_PRESETS } from '@/lib/constants';

export function CaptionStylePanel() {
  const globalStyle = useCaptionStore((s) => s.globalStyle);
  const setGlobalStyle = useCaptionStore((s) => s.setGlobalStyle);
  const applyGlobalStyle = useCaptionStore((s) => s.applyGlobalStyle);

  const presetEntries = Object.entries(CAPTION_PRESETS);

  return (
    <div className="p-3 space-y-4">
      {/* Presets */}
      <div>
        <h4 className="text-xs font-medium text-text-secondary mb-2">
          Presets
        </h4>
        <div className="grid grid-cols-2 gap-2">
          {presetEntries.map(([key, preset]) => (
            <button
              key={key}
              onClick={() => {
                setGlobalStyle({
                  fontFamily: preset.fontFamily,
                  fontWeight: preset.fontWeight,
                  color: preset.color,
                  backgroundColor: preset.backgroundColor,
                  strokeWidth: preset.strokeWidth,
                  strokeColor: preset.strokeColor,
                  shadowColor: preset.shadowColor,
                  shadowBlur: preset.shadowBlur,
                });
                applyGlobalStyle();
              }}
              className="p-3 rounded-lg border border-border-default hover:border-accent-primary bg-bg-surface transition-colors text-left"
            >
              <span
                className="block text-sm font-bold"
                style={{
                  fontFamily: preset.fontFamily,
                  color: preset.color,
                  textShadow:
                    preset.shadowBlur > 0
                      ? `0 0 ${preset.shadowBlur}px ${preset.shadowColor}`
                      : 'none',
                  WebkitTextStroke:
                    preset.strokeWidth > 0
                      ? `${preset.strokeWidth}px ${preset.strokeColor}`
                      : 'none',
                }}
              >
                {preset.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Font */}
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1.5">
          Fonte
        </label>
        <select
          value={globalStyle.fontFamily}
          onChange={(e) => setGlobalStyle({ fontFamily: e.target.value })}
          className="w-full bg-bg-surface border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="Inter">Inter</option>
          <option value="Montserrat">Montserrat</option>
          <option value="Bebas Neue">Bebas Neue</option>
          <option value="Arial">Arial</option>
          <option value="Georgia">Georgia</option>
        </select>
      </div>

      {/* Font Size */}
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1.5">
          Tamanho ({globalStyle.fontSize}{globalStyle.fontSizeUnit})
        </label>
        <input
          type="range"
          min={1}
          max={12}
          step={0.5}
          value={globalStyle.fontSize}
          onChange={(e) =>
            setGlobalStyle({ fontSize: Number(e.target.value) })
          }
          className="w-full"
        />
      </div>

      {/* Color */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-text-secondary block mb-1.5">
            Cor do texto
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={globalStyle.color}
              onChange={(e) => setGlobalStyle({ color: e.target.value })}
              className="w-8 h-8 rounded border border-border-default cursor-pointer"
            />
            <span className="text-xs font-mono text-text-muted">
              {globalStyle.color}
            </span>
          </div>
        </div>
        <div className="flex-1">
          <label className="text-xs font-medium text-text-secondary block mb-1.5">
            Cor de destaque
          </label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={globalStyle.highlightColor}
              onChange={(e) =>
                setGlobalStyle({ highlightColor: e.target.value })
              }
              className="w-8 h-8 rounded border border-border-default cursor-pointer"
            />
            <span className="text-xs font-mono text-text-muted">
              {globalStyle.highlightColor}
            </span>
          </div>
        </div>
      </div>

      {/* Animation */}
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1.5">
          Animação
        </label>
        <select
          value={globalStyle.animation}
          onChange={(e) =>
            setGlobalStyle({
              animation: e.target.value as typeof globalStyle.animation,
            })
          }
          className="w-full bg-bg-surface border border-border-default rounded-lg px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="none">Nenhuma</option>
          <option value="fade">Fade In</option>
          <option value="slide">Slide Up</option>
          <option value="pop">Pop</option>
          <option value="typewriter">Typewriter</option>
          <option value="word-by-word">Palavra por palavra</option>
        </select>
      </div>

      {/* Apply Button */}
      <button
        onClick={applyGlobalStyle}
        className="w-full py-2 rounded-lg bg-accent-primary hover:bg-blue-600 text-white text-sm font-medium transition-colors"
      >
        Aplicar em todas as legendas
      </button>
    </div>
  );
}
