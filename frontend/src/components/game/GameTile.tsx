import { useState, useRef, useCallback, useEffect } from 'react';
import TilePopup from './TilePopup';

interface GameTileProps {
  word: string;
  emoji: string;
  inDegree: number;
  isClickable: boolean;
  onClick: () => void;
}

const CELL = 84;
const LONG_PRESS_MS = 500;

export default function GameTile({ word, emoji, inDegree, isClickable, onClick }: GameTileProps) {
  const [popupAnchor, setPopupAnchor] = useState<HTMLElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const btnRef = useRef<HTMLButtonElement>(null);

  // Cleanup long-press timer on unmount
  useEffect(() => {
    return () => clearTimeout(longPressTimer.current);
  }, []);

  const showPopup = useCallback((el: HTMLElement) => {
    setPopupAnchor(el);
  }, []);

  const handleMouseDown = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      if (btnRef.current) showPopup(btnRef.current);
    }, LONG_PRESS_MS);
  }, [showPopup]);

  const handleMouseUp = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (btnRef.current) showPopup(btnRef.current);
  }, [showPopup]);

  const badge = (
    <span
      className="absolute flex items-center justify-center font-mono"
      style={{
        top: -1,
        right: -1,
        width: 16,
        height: 16,
        borderRadius: '50%',
        fontSize: 8,
        fontWeight: 700,
        background: isClickable ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.05)',
        color: isClickable ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)',
      }}
    >
      {inDegree}
    </span>
  );

  const content = (
    <div className="flex flex-col items-center justify-center gap-0">
      <span style={{ fontSize: 24, lineHeight: 1.3 }}>{emoji}</span>
      <span
        className="truncate text-center select-none leading-tight"
        style={{ fontSize: 13, fontWeight: 700, maxWidth: CELL - 10 }}
      >
        {word}
      </span>
    </div>
  );

  if (!isClickable) {
    return (
      <div
        className="relative rounded-md border overflow-hidden flex items-center justify-center pointer-events-none select-none opacity-40 grayscale"
        style={{
          width: CELL,
          height: CELL,
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-secondary)',
          color: 'var(--text-tertiary)',
        }}
      >
        {content}
        {badge}
      </div>
    );
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={onClick}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={handleContextMenu}
        className="relative rounded-md border overflow-hidden flex items-center justify-center hover:brightness-110 hover:-translate-y-0.5 active:scale-95 transition-all duration-100 cursor-pointer select-none"
        style={{
          width: CELL,
          height: CELL,
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
          color: 'var(--text-primary)',
        }}
      >
        {content}
        {badge}
      </button>
      <TilePopup word={word} anchorEl={popupAnchor} onClose={() => setPopupAnchor(null)} />
    </>
  );
}
