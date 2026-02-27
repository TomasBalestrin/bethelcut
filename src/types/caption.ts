export interface Caption {
  id: string;
  projectId: string;
  transcriptionId: string | null;
  clipId: string | null;
  text: string;
  startTimeMs: number;
  endTimeMs: number;
  positionXPct: number;
  positionYPct: number;
  maxWidthPct: number;
  style: CaptionStyle;
  highlightedWords: HighlightedWord[];
  wordTimings: WordTiming[];
  orderIndex: number;
}

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  fontSizeUnit: 'vw' | 'px' | 'em';
  fontWeight: string;
  color: string;
  backgroundColor: string;
  backgroundPadding: number;
  borderRadius: number;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  textAlign: 'left' | 'center' | 'right';
  maxLines: number;
  animation: 'none' | 'fade' | 'slide' | 'pop' | 'typewriter' | 'word-by-word';
  highlightColor: string;
  highlightActive: boolean;
}

export interface HighlightedWord {
  wordIndex: number;
  color: string;
  scale: number;
}

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TranscriptionSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence: number;
}

export interface TranscriptionWord {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
}
