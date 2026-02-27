import type { AspectRatioKey } from '@/lib/constants';

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  aspectRatio: AspectRatioKey;
  resolutionWidth: number;
  resolutionHeight: number;
  fps: number;
  durationMs: number;
  thumbnailUrl: string | null;
  status: 'draft' | 'processing' | 'ready' | 'exported' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface MediaAsset {
  id: string;
  projectId: string;
  userId: string;
  type: 'video' | 'audio' | 'image';
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number | null;
  mimeType: string | null;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  waveformData: number[] | null;
  thumbnailUrl: string | null;
  createdAt: string;
}
