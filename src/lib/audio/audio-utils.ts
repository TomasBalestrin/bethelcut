export function normalizeWaveform(data: number[]): number[] {
  const max = Math.max(...data);
  if (max === 0) return data;
  return data.map((v) => v / max);
}

export function downsampleWaveform(
  data: number[],
  targetLength: number
): number[] {
  if (data.length <= targetLength) return data;

  const blockSize = Math.floor(data.length / targetLength);
  const result: number[] = new Array(targetLength);

  for (let i = 0; i < targetLength; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, data.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      if (Math.abs(data[j]) > max) max = Math.abs(data[j]);
    }
    result[i] = max;
  }

  return result;
}

export function calculateRMS(data: Float32Array, start: number, end: number): number {
  let sum = 0;
  const length = end - start;
  for (let i = start; i < end; i++) {
    sum += data[i] * data[i];
  }
  return Math.sqrt(sum / length);
}
