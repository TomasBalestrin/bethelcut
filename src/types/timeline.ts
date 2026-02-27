export interface TimelineTrack {
  id: string;
  projectId: string;
  type: 'video' | 'audio' | 'caption' | 'effect';
  label: string;
  orderIndex: number;
  isLocked: boolean;
  isMuted: boolean;
  isHidden: boolean;
  height: number;
  clips: TimelineClip[];
}

export interface TimelineClip {
  id: string;
  trackId: string;
  assetId: string | null;
  clipType: 'video' | 'audio' | 'caption' | 'effect' | 'silence_marker';
  startTimeMs: number;
  endTimeMs: number;
  sourceInMs: number;
  sourceOutMs: number;
  properties: ClipProperties;
  orderIndex: number;
}

export interface ClipProperties {
  speed?: number;
  volume?: number;
  opacity?: number;
  filters?: Record<string, number>;
  transform?: {
    x: number;
    y: number;
    scale: number;
    rotation: number;
  };
}

export interface TimelineState {
  tracks: TimelineTrack[];
  pixelsPerSecond: number;
  scrollX: number;
  scrollY: number;
  snapEnabled: boolean;
  magnetEnabled: boolean;
}
