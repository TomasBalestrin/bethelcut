import { EDITOR_CONFIG } from '@/lib/constants';

export async function extractWaveformData(
  audioBuffer: AudioBuffer,
  samplesPerSecond: number = EDITOR_CONFIG.WAVEFORM_SAMPLES_PER_SECOND
): Promise<number[]> {
  const channelData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const samplesPerPoint = Math.floor(sampleRate / samplesPerSecond);
  const totalPoints = Math.ceil(channelData.length / samplesPerPoint);
  const waveform: number[] = new Array(totalPoints);

  for (let i = 0; i < totalPoints; i++) {
    const start = i * samplesPerPoint;
    const end = Math.min(start + samplesPerPoint, channelData.length);
    let maxAmplitude = 0;

    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > maxAmplitude) maxAmplitude = abs;
    }

    waveform[i] = maxAmplitude;
  }

  return waveform;
}

export async function decodeAudioFromVideo(
  videoUrl: string
): Promise<AudioBuffer> {
  const audioContext = new AudioContext();

  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Erro ao baixar o vídeo: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error('O arquivo de vídeo está vazio');
  }
  return audioContext.decodeAudioData(arrayBuffer);
}

export function amplitudeToDb(amplitude: number): number {
  if (amplitude === 0) return -Infinity;
  return 20 * Math.log10(amplitude);
}

export function dbToAmplitude(db: number): number {
  return Math.pow(10, db / 20);
}
