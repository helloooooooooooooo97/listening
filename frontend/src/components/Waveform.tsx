import { useEffect, useRef, useCallback, useState } from 'react';
import { extractWaveform, cacheWaveform, getCachedWaveform } from '../lib/waveform';

interface Props {
  lessonId: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  height?: number;
  playedColor?: string;
  unplayedColor?: string;
}

export default function Waveform({
  lessonId,
  currentTime,
  duration,
  onSeek,
  height = 48,
  playedColor = '#fa2d48',
  unplayedColor = 'rgba(255,255,255,0.08)',
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peaksRef = useRef<Float32Array | null>(null);
  const [ready, setReady] = useState(false);

  // Resize canvas to match container
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    canvas.width = w * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${height}px`;
  }, [height]);

  // Load waveform
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      // Check cache
      const key = `waveform:${lessonId}`;
      const cached = getCachedWaveform(key);
      if (cached) {
        peaksRef.current = cached.peaks;
        if (!cancelled) setReady(true);
        return;
      }
      try {
        const data = await extractWaveform(`/api/lessons/${lessonId}/audio`);
        cacheWaveform(key, data);
        peaksRef.current = data.peaks;
        if (!cancelled) setReady(true);
      } catch {
        peaksRef.current = null;
        if (!cancelled) setReady(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [lessonId]);

  // Bind resize
  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeCanvas, ready]);

  // Draw waveform + progress
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const peaks = peaksRef.current;
    if (!peaks) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width;
    const h = canvas.height;
    const mid = h / 2;

    ctx.clearRect(0, 0, w, h);

    const len = peaks.length;
    const stepX = w / len;
    const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    const playedIdx = Math.floor(progress * len);

    for (let i = 0; i < len; i++) {
      const x = i * stepX;
      const peak = peaks[i] * mid * 0.85;
      const barW = Math.max(1, stepX - 0.8);

      ctx.fillStyle = i < playedIdx ? playedColor : unplayedColor;
      ctx.fillRect(x, mid - peak, barW, Math.max(1, peak * 2));
    }
  }, [currentTime, duration, ready, playedColor, unplayedColor]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = x / rect.width;
    onSeek(Math.max(0, Math.min(duration, pct * duration)));
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full cursor-pointer group"
      style={{ height }}
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="rounded"
      />
    </div>
  );
}
