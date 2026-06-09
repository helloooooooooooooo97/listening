/** Waveform data extraction using Web Audio API. */

/** OfflineAudioContext for decoding — no autoplay restrictions (unlike AudioContext in Chrome/Edge). */
let _offlineCtx: OfflineAudioContext | null = null;

function getAudioContext(): OfflineAudioContext {
  if (!_offlineCtx) {
    // Length and sample rate don't matter for decodeAudioData — we only use it for decoding
    _offlineCtx = new OfflineAudioContext(1, 1, 44100);
  }
  return _offlineCtx;
}

export interface WaveformData {
  /** Normalized peak values (0-1) for each sample point. */
  peaks: Float32Array;
  /** Duration of the audio in seconds. */
  duration: number;
  /** Number of sample points. */
  samples: number;
}

/**
 * Fetch audio from a URL, decode it, and extract waveform peak data.
 * @param url - Audio file URL
 * @param targetSamples - Number of waveform points to generate (default 800)
 */
export async function extractWaveform(url: string, targetSamples = 800): Promise<WaveformData> {
  const res = await fetch(url);
  const arrayBuffer = await res.arrayBuffer();
  const ctx = getAudioContext();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  const duration = audioBuffer.duration;
  const channelData = audioBuffer.getChannelData(0); // Use first channel
  const totalSamples = channelData.length;
  const blockSize = Math.max(1, Math.floor(totalSamples / targetSamples));

  const peaks = new Float32Array(targetSamples);
  for (let i = 0; i < targetSamples; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, totalSamples);
    let max = 0;
    for (let j = start; j < end; j++) {
      const abs = Math.abs(channelData[j]);
      if (abs > max) max = abs;
    }
    peaks[i] = max;
  }

  return { peaks, duration, samples: targetSamples };
}

/**
 * Create a waveform cache key for a lesson ID.
 */
export function waveformCacheKey(lessonId: string): string {
  return `waveform:${lessonId}`;
}

// In-memory cache
const _waveCache = new Map<string, WaveformData>();

export function getCachedWaveform(lessonId: string): WaveformData | undefined {
  return _waveCache.get(waveformCacheKey(lessonId));
}

export function cacheWaveform(lessonId: string, data: WaveformData): void {
  _waveCache.set(waveformCacheKey(lessonId), data);
}
