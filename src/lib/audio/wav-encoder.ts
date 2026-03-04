/**
 * Encode an AudioBuffer to a 16kHz mono 16-bit WAV Blob.
 * This produces much smaller files than sending full video to Whisper API.
 */
export function encodeAudioBufferToWav(audioBuffer: AudioBuffer): Blob {
  const targetSampleRate = 16000;
  const numChannels = 1; // mono

  // Mix down to mono
  const monoData = new Float32Array(audioBuffer.length);
  for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
    const channelData = audioBuffer.getChannelData(ch);
    for (let i = 0; i < audioBuffer.length; i++) {
      monoData[i] += channelData[i] / audioBuffer.numberOfChannels;
    }
  }

  // Downsample to 16kHz
  const ratio = audioBuffer.sampleRate / targetSampleRate;
  const newLength = Math.floor(monoData.length / ratio);
  const downsampled = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const srcIndex = Math.floor(i * ratio);
    downsampled[i] = monoData[srcIndex];
  }

  // Convert to 16-bit PCM
  const pcmData = new Int16Array(downsampled.length);
  for (let i = 0; i < downsampled.length; i++) {
    const s = Math.max(-1, Math.min(1, downsampled[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  // Build WAV file
  const dataLength = pcmData.length * 2;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, 'WAVE');

  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, targetSampleRate * numChannels * 2, true); // byte rate
  view.setUint16(32, numChannels * 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write PCM samples
  const output = new Int16Array(buffer, 44);
  output.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
