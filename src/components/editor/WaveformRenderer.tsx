'use client';

import { useEffect, useRef } from 'react';
import { THEME } from '@/lib/constants';

interface WaveformRendererProps {
  data: number[];
  width: number;
  height: number;
  color?: string;
  currentTimeRatio?: number;
}

export function WaveformRenderer({
  data,
  width,
  height,
  color = THEME.timeline.audio,
  currentTimeRatio = 0,
}: WaveformRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const barWidth = width / data.length;
    const center = height / 2;

    for (let i = 0; i < data.length; i++) {
      const amplitude = data[i] * center * 0.9;
      const x = i * barWidth;
      const isPast = i / data.length < currentTimeRatio;

      ctx.fillStyle = isPast ? color : color + '60';
      ctx.fillRect(x, center - amplitude, Math.max(barWidth - 1, 1), amplitude * 2);
    }
  }, [data, width, height, color, currentTimeRatio]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block"
    />
  );
}
