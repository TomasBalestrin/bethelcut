import type { AspectRatioKey } from '@/lib/constants';

export interface EditorState {
  projectId: string;
  isPlaying: boolean;
  currentTimeMs: number;
  durationMs: number;
  volume: number;
  isMuted: boolean;
  zoom: number;
  aspectRatio: AspectRatioKey;
  selectedClipId: string | null;
  selectedTrackId: string | null;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  activeTab: 'media' | 'captions' | 'silence' | 'ai-cut' | 'effects';
}

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  fps: number;
  codec: string;
}

export interface UploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
}
