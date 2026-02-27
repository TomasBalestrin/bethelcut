export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  fps: number;
}

export function getVideoMetadata(
  videoElement: HTMLVideoElement
): VideoMetadata {
  return {
    width: videoElement.videoWidth,
    height: videoElement.videoHeight,
    duration: videoElement.duration,
    fps: 30, // Default; precise FPS detection requires media capabilities API
  };
}

export function generateVideoThumbnail(
  videoUrl: string,
  timeSeconds: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.currentTime = timeSeconds;

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        ctx.drawImage(video, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch (err) {
        reject(err);
      }
    });

    video.addEventListener('error', () => {
      reject(new Error('Failed to load video'));
    });

    video.load();
  });
}
