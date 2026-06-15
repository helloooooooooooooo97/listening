import { useEffect, useRef, useCallback, useState } from 'react';
import { extractWaveform, cacheWaveform, getCachedWaveform } from '../lib/waveform';
import { useThemeStore } from '../stores/themeStore';
import { API_BASE } from '../lib/api';

/** Build the audio URL: relative path in browser dev mode (Vite proxy), full URL in Tauri. */
function audioUrl(lessonId: string): string {
  const isBrowser = typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
  return isBrowser
    ? `/api/lessons/${lessonId}/audio`           // Vite proxy handles it
    : `${API_BASE}/api/lessons/${lessonId}/audio`; // Tauri production
}

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
  /** Called when user drags to create a new selection range on the waveform */
  onSelectionDrag?: (range: { start: number; end: number } | null) => void;
}

function fmt(t: number) { const m = Math.floor(t / 60); return `${m}:${Math.floor(t % 60).toString().padStart(2, '0')}`; }

const HIGHLIGHT = 'rgba(250,204,21,0.5)';
const HIGHLIGHT_BORDER = 'rgba(250,204,21,0.8)';

export default function Waveform({
  lessonId, currentTime, duration, onSeek, height = 48,
  playedColor, unplayedColor, selectionRange, onSelectionDrag,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const peaksRef = useRef<Float32Array | null>(null);
  const [ready, setReady] = useState(false);
  const [resizeKey, setResizeKey] = useState(0);
  const theme = useThemeStore(s => s.mode);

  // Hover & ripple state
  const [hoverTime, setHoverTime] = useState<{ x: number; time: number } | null>(null);
  const [ripple, setRipple] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef<number>(0);
  const [dragRange, setDragRange] = useState<{ start: number; end: number } | null>(null);
  const [thumbDragging, setThumbDragging] = useState(false);

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

  // Load waveform
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
        const data = await extractWaveform(audioUrl(lessonId));
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
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      resizeCanvas();
      setResizeKey(k => k + 1);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [resizeCanvas, ready]);

  // Draw
  const displayRange = dragRange || selectionRange || null;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const peaks = peaksRef.current;
    if (!peaks) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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
    if (displayRange && duration > 0) {
      selStart = Math.floor((displayRange.start / duration) * len);
      selEnd = Math.ceil((displayRange.end / duration) * len);
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
  }, [currentTime, duration, ready, resolvedPlayed, resolvedUnplayed, displayRange, theme, resizeKey]);

  const getTimeFromEvent = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return { pct, time: pct * duration };
  };

  // Click: seek with ripple
  const handleClick = (e: React.MouseEvent) => {
    if (dragging || thumbDragging) return;
    const { time } = getTimeFromEvent(e);
    const rect = e.currentTarget.getBoundingClientRect();
    const rippleX = ((e.clientX - rect.left) / rect.width) * 100;
    setRipple({ x: rippleX, y: 50 });
    setTimeout(() => setRipple(null), 400);
    onSeek(Math.max(0, Math.min(duration, time)));
  };

  // Thumb drag handlers
  const handleThumbDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setThumbDragging(true);
    const { time } = getTimeFromEvent(e);
    onSeek(Math.max(0, Math.min(duration, time)));
  };

  // Mouse move: hover preview, thumb drag, or selection drag update
  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * duration;
    setHoverTime({ x: (e.clientX - rect.left), time });

    if (thumbDragging) {
      onSeek(Math.max(0, Math.min(duration, time)));
    } else if (dragging && onSelectionDrag) {
      const start = dragStartRef.current;
      const end = time;
      if (Math.abs(end - start) > 0.1) {
        setDragRange({ start: Math.min(start, end), end: Math.max(start, end) });
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!onSelectionDrag || thumbDragging) return;
    const { time } = getTimeFromEvent(e);
    dragStartRef.current = time;
    setDragging(true);
    setDragRange(null);
  };

  const handleMouseUp = () => {
    if (dragging && dragRange && onSelectionDrag) {
      onSelectionDrag(dragRange);
    }
    setDragging(false);
    setDragRange(null);
    setThumbDragging(false);
  };

  // Global mouseup cleanup
  useEffect(() => {
    if (!dragging && !thumbDragging) return;
    const up = () => { setDragging(false); setDragRange(null); setThumbDragging(false); };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [dragging, thumbDragging]);

  return (
    <div
      ref={containerRef}
      className="relative w-full cursor-pointer group"
      style={{ height }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { setHoverTime(null); if (!dragging) setDragRange(null); }}
    >
      <canvas ref={canvasRef} className="rounded" />

      {/* Draggable thumb */}
      {duration > 0 && (
        <div
          className="absolute top-0 bottom-0 w-2 -ml-1 cursor-ew-resize z-10 group/thumb"
          style={{ left: `${(currentTime / duration) * 100}%` }}
          onMouseDown={handleThumbDown}
        >
          {/* Visible handle */}
          <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[var(--accent)] shadow-md opacity-40 group-hover/thumb:opacity-100 group-hover:scale-110 transition-all duration-150" />
        </div>
      )}

      {/* Hover time tooltip */}
      {hoverTime && !dragging && (
        <div
          className="absolute -top-6 transform -translate-x-1/2 px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border-primary)] shadow pointer-events-none z-10"
          style={{ left: hoverTime.x }}
        >
          <span className="text-[10px] font-mono tabular-nums text-tertiary">{fmt(hoverTime.time)}</span>
        </div>
      )}

      {/* Drag range tooltip */}
      {dragRange && dragging && (
        <div
          className="absolute -top-6 transform -translate-x-1/2 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 shadow pointer-events-none z-10"
          style={{ left: hoverTime?.x || 0 }}
        >
          <span className="text-[10px] font-mono tabular-nums text-amber-600">
            {fmt(dragRange.start)} – {fmt(dragRange.end)}
          </span>
        </div>
      )}

      {/* Click ripple */}
      {ripple && (
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-[var(--accent)]/30 pointer-events-none animate-scale-in"
          style={{ left: `${ripple.x}%`, marginLeft: -8 }}
        />
      )}
    </div>
  );
}
