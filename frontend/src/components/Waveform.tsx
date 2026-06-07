import { useEffect, useRef, useCallback, useState } from 'react';
import { extractWaveform, cacheWaveform, getCachedWaveform } from '../lib/waveform';
import { useThemeStore } from '../stores/themeStore';

/** Resolve a CSS variable value for use in Canvas 2D context. */
function cssVar(name: string, fallback = '#fa2d48'): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

interface Props {
  lessonId: string;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  height?: number;
  playedColor?: string;
  unplayedColor?: string;
  selectionRange?: { start: number; end: number } | null;
}

const HIGHLIGHT = 'rgba(250,204,21,0.5)';
const HIGHLIGHT_BORDER = 'rgba(250,204,21,0.8)';

export default function Waveform({
  lessonId,
  currentTime,
  duration,
  onSeek,
  height = 48,
  playedColor,
  unplayedColor,
  selectionRange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peaksRef = useRef<Float32Array | null>(null);
  const [ready, setReady] = useState(false);
  const theme = useThemeStore(s => s.mode);

  const resolvedPlayed = playedColor || cssVar('--accent', '#fa2d48');
  const resolvedUnplayed = unplayedColor || cssVar('--waveform-unplayed', 'rgba(255,255,255,0.08)');

  // Resize canvas
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

  // Load waveform (already cached in lib/waveform.ts)
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [resizeCanvas, ready]);

  // Draw
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

    // Selection range
    let selStart = -1, selEnd = -1;
    if (selectionRange && duration > 0) {
      selStart = Math.floor((selectionRange.start / duration) * len);
      selEnd = Math.ceil((selectionRange.end / duration) * len);
    }

    for (let i = 0; i < len; i++) {
      const x = i * stepX;
      const peak = peaks[i] * mid * 0.85;
      const barW = Math.max(1, stepX - 0.8);
      const isSel = i >= selStart && i <= selEnd;
      const isPlayed = i < playedIdx;

      if (isSel) {
        ctx.fillStyle = 'rgba(250,204,21,0.08)';
        ctx.fillRect(x, 0, barW, h);
      }

      ctx.fillStyle = isPlayed ? resolvedPlayed : (isSel ? HIGHLIGHT : resolvedUnplayed);
      ctx.fillRect(x, mid - peak, barW, Math.max(1, peak * 2));
    }

    // Selection border lines
    if (selStart >= 0) {
      ctx.strokeStyle = HIGHLIGHT_BORDER;
      ctx.lineWidth = 1.5;
      const sx = selStart * stepX;
      ctx.beginPath(); ctx.moveTo(sx, 4); ctx.lineTo(sx, h - 4); ctx.stroke();
      const ex = selEnd * stepX + stepX;
      ctx.beginPath(); ctx.moveTo(ex, 4); ctx.lineTo(ex, h - 4); ctx.stroke();
    }
  }, [currentTime, duration, ready, resolvedPlayed, resolvedUnplayed, selectionRange, theme]);

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
      <canvas ref={canvasRef} className="rounded" />
    </div>
  );
}
