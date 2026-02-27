export const THEME = {
  bg: {
    primary: '#1a1a2e',
    secondary: '#16213e',
    tertiary: '#0f3460',
    timeline: '#111827',
    surface: '#1e293b',
    hover: '#334155',
  },
  text: {
    primary: '#f1f5f9',
    secondary: '#94a3b8',
    muted: '#64748b',
    accent: '#38bdf8',
  },
  accent: {
    primary: '#3b82f6',
    secondary: '#8b5cf6',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
  },
  timeline: {
    playhead: '#ef4444',
    clip: '#3b82f6',
    audio: '#22c55e',
    caption: '#f59e0b',
    silence: 'rgba(239,68,68,0.3)',
    selection: 'rgba(59,130,246,0.2)',
  },
  border: {
    default: '#334155',
    active: '#3b82f6',
  },
} as const;

export const ASPECT_RATIOS = {
  '16:9': { width: 1920, height: 1080, label: 'Landscape (YouTube)' },
  '9:16': { width: 1080, height: 1920, label: 'Portrait (TikTok/Reels)' },
  '1:1': { width: 1080, height: 1080, label: 'Square (Instagram)' },
  '4:5': { width: 1080, height: 1350, label: 'Portrait (Instagram Feed)' },
  '4:3': { width: 1440, height: 1080, label: 'Standard' },
  '21:9': { width: 2560, height: 1080, label: 'Ultrawide (Cinema)' },
} as const;

export type AspectRatioKey = keyof typeof ASPECT_RATIOS;

export const CAPTION_PRESETS = {
  clean: {
    name: 'Clean',
    fontFamily: 'Inter',
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: 'rgba(0,0,0,0.7)',
    strokeWidth: 0,
    strokeColor: '#000000',
    shadowColor: 'transparent',
    shadowBlur: 0,
  },
  glow: {
    name: 'Glow',
    fontFamily: 'Inter',
    fontWeight: 'bold',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    strokeWidth: 2,
    strokeColor: '#000',
    shadowColor: '#3b82f6',
    shadowBlur: 20,
  },
  trending: {
    name: 'Trending',
    fontFamily: 'Montserrat',
    fontWeight: '900',
    color: '#FFD700',
    backgroundColor: 'transparent',
    strokeWidth: 3,
    strokeColor: '#000',
    shadowColor: 'transparent',
    shadowBlur: 0,
  },
  minimal: {
    name: 'Minimal',
    fontFamily: 'Inter',
    fontWeight: 'normal',
    color: '#FFFFFF',
    backgroundColor: 'transparent',
    strokeWidth: 1,
    strokeColor: 'rgba(0,0,0,0.5)',
    shadowColor: 'transparent',
    shadowBlur: 0,
  },
  bold: {
    name: 'Bold',
    fontFamily: 'Bebas Neue',
    fontWeight: 'bold',
    color: '#FF0000',
    backgroundColor: '#FFFFFF',
    strokeWidth: 0,
    strokeColor: '#000000',
    shadowColor: 'transparent',
    shadowBlur: 0,
  },
} as const;

export const KEYBOARD_SHORTCUTS = {
  PLAY_PAUSE: ' ',
  SPLIT: 'b',
  DELETE: 'Delete',
  UNDO: 'mod+z',
  REDO: 'mod+shift+z',
  SAVE: 'mod+s',
  ZOOM_IN: 'mod+=',
  ZOOM_OUT: 'mod+-',
} as const;

export const EDITOR_CONFIG = {
  TIMELINE_MIN_HEIGHT: 150,
  TIMELINE_DEFAULT_HEIGHT: 250,
  TIMELINE_MAX_HEIGHT: 500,
  LEFT_PANEL_WIDTH: 280,
  RIGHT_PANEL_WIDTH: 320,
  TOOLBAR_HEIGHT: 48,
  MIN_EDITOR_WIDTH: 1280,
  AUTOSAVE_INTERVAL_MS: 30000,
  WAVEFORM_SAMPLES_PER_SECOND: 100,
} as const;

export const SILENCE_DETECTION_DEFAULTS = {
  thresholdDb: -35,
  minDurationMs: 500,
  paddingMs: 150,
  removeFillerWords: false,
  fillerWords: ['um', 'é', 'tipo', 'né', 'ah', 'eh'],
  cutMode: 'remove' as const,
} as const;
