'use client';

import { create } from 'zustand';
import type { Caption, CaptionStyle } from '@/types/caption';

interface CaptionStore {
  captions: Caption[];
  selectedCaptionId: string | null;
  editMode: 'timeline' | 'list';
  globalStyle: CaptionStyle;

  setCaptions: (captions: Caption[]) => void;
  addCaption: (caption: Caption) => void;
  removeCaption: (id: string) => void;
  updateCaption: (id: string, updates: Partial<Caption>) => void;
  setSelectedCaptionId: (id: string | null) => void;
  setEditMode: (mode: 'timeline' | 'list') => void;
  setGlobalStyle: (style: Partial<CaptionStyle>) => void;
  applyGlobalStyle: () => void;
  reset: () => void;
}

const defaultStyle: CaptionStyle = {
  fontFamily: 'Inter',
  fontSize: 4.5,
  fontSizeUnit: 'vw',
  fontWeight: 'bold',
  color: '#FFFFFF',
  backgroundColor: 'rgba(0,0,0,0.6)',
  backgroundPadding: 8,
  borderRadius: 4,
  strokeColor: '#000000',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0.5)',
  shadowBlur: 4,
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  textAlign: 'center',
  maxLines: 2,
  animation: 'none',
  highlightColor: '#FFD700',
  highlightActive: false,
};

export const useCaptionStore = create<CaptionStore>((set, get) => ({
  captions: [],
  selectedCaptionId: null,
  editMode: 'timeline',
  globalStyle: defaultStyle,

  setCaptions: (captions) => set({ captions }),
  addCaption: (caption) =>
    set((state) => ({ captions: [...state.captions, caption] })),
  removeCaption: (id) =>
    set((state) => ({
      captions: state.captions.filter((c) => c.id !== id),
      selectedCaptionId:
        state.selectedCaptionId === id ? null : state.selectedCaptionId,
    })),
  updateCaption: (id, updates) =>
    set((state) => ({
      captions: state.captions.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  setSelectedCaptionId: (id) => set({ selectedCaptionId: id }),
  setEditMode: (mode) => set({ editMode: mode }),
  setGlobalStyle: (style) =>
    set((state) => ({
      globalStyle: { ...state.globalStyle, ...style },
    })),
  applyGlobalStyle: () => {
    const { captions, globalStyle } = get();
    set({
      captions: captions.map((c) => ({ ...c, style: { ...globalStyle } })),
    });
  },
  reset: () =>
    set({
      captions: [],
      selectedCaptionId: null,
      editMode: 'timeline',
      globalStyle: defaultStyle,
    }),
}));
