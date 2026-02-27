import type { Caption, CaptionStyle, WordTiming } from '@/types/caption';
import { generateId } from '@/lib/utils';

const DEFAULT_STYLE: CaptionStyle = {
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

export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
  confidence: number;
}

export function groupWordsIntoCaptions(
  words: WordTimestamp[],
  projectId: string,
  maxWordsPerCaption: number = 8,
  maxDurationMs: number = 5000
): Caption[] {
  const captions: Caption[] = [];
  let currentWords: WordTimestamp[] = [];
  let captionStartMs = 0;

  for (const word of words) {
    if (currentWords.length === 0) {
      captionStartMs = word.startMs;
    }

    currentWords.push(word);

    const shouldBreak =
      currentWords.length >= maxWordsPerCaption ||
      word.endMs - captionStartMs >= maxDurationMs;

    if (shouldBreak) {
      const text = currentWords.map((w) => w.word).join(' ');
      const wordTimings: WordTiming[] = currentWords.map((w) => ({
        word: w.word,
        startMs: w.startMs,
        endMs: w.endMs,
      }));

      captions.push({
        id: generateId(),
        projectId,
        transcriptionId: null,
        clipId: null,
        text,
        startTimeMs: captionStartMs,
        endTimeMs: currentWords[currentWords.length - 1].endMs,
        positionXPct: 50,
        positionYPct: 85,
        maxWidthPct: 80,
        style: { ...DEFAULT_STYLE },
        highlightedWords: [],
        wordTimings,
        orderIndex: captions.length,
      });

      currentWords = [];
    }
  }

  // Remaining words
  if (currentWords.length > 0) {
    const text = currentWords.map((w) => w.word).join(' ');
    const wordTimings: WordTiming[] = currentWords.map((w) => ({
      word: w.word,
      startMs: w.startMs,
      endMs: w.endMs,
    }));

    captions.push({
      id: generateId(),
      projectId,
      transcriptionId: null,
      clipId: null,
      text,
      startTimeMs: captionStartMs,
      endTimeMs: currentWords[currentWords.length - 1].endMs,
      positionXPct: 50,
      positionYPct: 85,
      maxWidthPct: 80,
      style: { ...DEFAULT_STYLE },
      highlightedWords: [],
      wordTimings,
      orderIndex: captions.length,
    });
  }

  return captions;
}
