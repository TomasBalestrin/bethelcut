import type { Caption } from '@/types/caption';

export function captionsToSrt(captions: Caption[]): string {
  const sorted = [...captions].sort((a, b) => a.startTimeMs - b.startTimeMs);

  return sorted
    .map((caption, index) => {
      const start = msToSrtTime(caption.startTimeMs);
      const end = msToSrtTime(caption.endTimeMs);
      return `${index + 1}\n${start} --> ${end}\n${caption.text}\n`;
    })
    .join('\n');
}

export function parseSrt(srt: string): Array<{
  text: string;
  startMs: number;
  endMs: number;
}> {
  const blocks = srt.trim().split(/\n\n+/);
  const results: Array<{ text: string; startMs: number; endMs: number }> = [];

  for (const block of blocks) {
    const lines = block.split('\n');
    if (lines.length < 3) continue;

    const timeLine = lines[1];
    const match = timeLine.match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    );
    if (!match) continue;

    const startMs = srtTimeToMs(match[1]);
    const endMs = srtTimeToMs(match[2]);
    const text = lines.slice(2).join('\n');

    results.push({ text, startMs, endMs });
  }

  return results;
}

function msToSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function srtTimeToMs(time: string): number {
  const [h, m, rest] = time.split(':');
  const [s, ms] = rest.split(',');
  return (
    Number(h) * 3600000 +
    Number(m) * 60000 +
    Number(s) * 1000 +
    Number(ms)
  );
}
