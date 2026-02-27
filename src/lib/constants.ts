export const THEME = {
  bg: {
    primary: '#08090f',
    secondary: '#0d1017',
    tertiary: '#13161f',
    timeline: '#060810',
    surface: '#111420',
    hover: '#191d2a',
  },
  text: {
    primary: '#dfe3ea',
    secondary: '#7c8696',
    muted: '#4a5264',
    accent: '#6889bf',
  },
  accent: {
    primary: '#3f6fad',
    secondary: '#5283bf',
    success: '#3e7d6a',
    warning: '#a6833f',
    danger: '#944646',
  },
  timeline: {
    playhead: '#6889bf',
    clip: '#3f6fad',
    audio: '#3e7d6a',
    caption: '#a6833f',
    silence: 'rgba(104,137,191,0.15)',
    selection: 'rgba(63,111,173,0.12)',
  },
  border: {
    default: '#181d2a',
    active: '#3f6fad',
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
