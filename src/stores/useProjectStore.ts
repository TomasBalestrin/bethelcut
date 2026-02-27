'use client';

import { create } from 'zustand';
import type { Project, MediaAsset } from '@/types/project';

interface ProjectStore {
  currentProject: Project | null;
  mediaAssets: MediaAsset[];
  isSaving: boolean;
  lastSavedAt: string | null;

  setCurrentProject: (project: Project | null) => void;
  updateProject: (updates: Partial<Project>) => void;
  setMediaAssets: (assets: MediaAsset[]) => void;
  addMediaAsset: (asset: MediaAsset) => void;
  removeMediaAsset: (id: string) => void;
  setIsSaving: (saving: boolean) => void;
  setLastSavedAt: (date: string) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  mediaAssets: [],
  isSaving: false,
  lastSavedAt: null,

  setCurrentProject: (project) => set({ currentProject: project }),
  updateProject: (updates) =>
    set((state) => ({
      currentProject: state.currentProject
        ? { ...state.currentProject, ...updates }
        : null,
    })),
  setMediaAssets: (assets) => set({ mediaAssets: assets }),
  addMediaAsset: (asset) =>
    set((state) => ({ mediaAssets: [...state.mediaAssets, asset] })),
  removeMediaAsset: (id) =>
    set((state) => ({
      mediaAssets: state.mediaAssets.filter((a) => a.id !== id),
    })),
  setIsSaving: (saving) => set({ isSaving: saving }),
  setLastSavedAt: (date) => set({ lastSavedAt: date }),
  reset: () =>
    set({
      currentProject: null,
      mediaAssets: [],
      isSaving: false,
      lastSavedAt: null,
    }),
}));
