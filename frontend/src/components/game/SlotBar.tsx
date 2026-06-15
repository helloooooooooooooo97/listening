import { useMemo, useRef, useState, useEffect } from 'react';
import { HiArrowPath, HiArrowUturnLeft, HiTrash } from 'react-icons/hi2';
import type { TileData } from './levelGenerator';

interface SlotBarProps {
  slot: (TileData | null)[];
  capacity: number;
  tools?: { shuffle: number; undo: number; remove3: number };
  lastMatchSuccess?: boolean;
  onShuffle?: () => void;
  onUndo?: () => void;
  onRemove3?: () => void;
}

const SLOT_MAX = 72;
const SLOT_MIN = 30;
const PADDING = 12; // p-1.5 horizontal
const GAP = 4;
const SEPARATOR = 9; // 1px width + 4px margin left + 4px margin right
const ITEM_COUNT = 10; // 7 slots + 3 tools

export default function SlotBar({ slot, capacity, tools, lastMatchSuccess, onShuffle, onUndo, onRemove3 }: SlotBarProps) {
  const filled = slot.filter(s => s !== null).length;
  const isAlmostFull = filled >= capacity - 1;

  // Detect words that appear exactly twice (≈ matching glow)
  const glowWords = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of slot) {
      if (s) counts.set(s.word, (counts.get(s.word) || 0) + 1);
    }
    const set = new Set<string>();
    for (const [word, count] of counts) {
      if (count === 2) set.add(word);
    }
    return set;
  }, [slot]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [itemSize, setItemSize] = useState(SLOT_MAX);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      const fixed = PADDING + (ITEM_COUNT - 1) * GAP + SEPARATOR;
      const perItem = Math.max(0, width - fixed) / ITEM_COUNT;
      setItemSize(Math.max(SLOT_MIN, Math.min(SLOT_MAX, Math.floor(perItem))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const small = itemSize < 46;

  return (
    <div ref={containerRef} className="w-full flex justify-center overflow-x-auto">
      <div className={`flex gap-1 p-1.5 rounded-xl border transition-colors duration-300 items-center flex-shrink-0
        ${isAlmostFull ? 'border-red-500/20 bg-red-500/5' : ''}
        ${lastMatchSuccess ? 'border-emerald-500/40 bg-emerald-500/10' : ''}`}
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-tertiary)' }}>
        {/* Slot items */}
        {Array.from({ length: capacity }, (_, i) => {
          const item = slot[i] ?? null;
          const isGlowing = item ? glowWords.has(item.word) : false;
          return <SlotItem key={i} item={item} isGlowing={isGlowing} size={itemSize} small={small} />;
        })}

        {/* Separator */}
        <div className="flex-shrink-0"
          style={{ width: 1, height: Math.max(24, itemSize * 0.55), background: 'var(--border-secondary)', margin: '0 4px' }} />

        {/* Tool items */}
        <ToolItem icon={<HiArrowPath size={14} />} label="洗牌" count={tools?.shuffle ?? 0} onClick={onShuffle} size={itemSize} small={small} />
        <ToolItem icon={<HiArrowUturnLeft size={14} />} label="撤回" count={tools?.undo ?? 0} onClick={onUndo} size={itemSize} small={small} />
        <ToolItem icon={<HiTrash size={14} />} label="移出" count={tools?.remove3 ?? 0} onClick={onRemove3} size={itemSize} small={small} />
      </div>
    </div>
  );
}

function SlotItem({ item, isGlowing, size, small }: { item: TileData | null; isGlowing: boolean; size: number; small: boolean }) {
  if (!item) {
    return (
      <div
        className="rounded-md border overflow-hidden flex items-center justify-center flex-shrink-0"
        style={{
          width: size,
          height: size,
          borderStyle: 'dashed',
          borderColor: 'var(--border-secondary)',
        }}
      />
    );
  }

  return (
    <div
      className={`rounded-md border overflow-hidden flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
        isGlowing ? 'ring-1 ring-amber-400/40' : ''
      }`}
      style={{
        width: size,
        height: size,
        background: 'var(--bg-secondary)',
        borderColor: isGlowing ? 'rgba(251,191,36,0.3)' : 'var(--border-primary)',
        color: 'var(--text-primary)',
        boxShadow: isGlowing ? 'inset 0 0 12px rgba(251,191,36,0.15)' : 'none',
      }}
    >
      <div className="flex flex-col items-center justify-center gap-0">
        <span style={{ fontSize: small ? Math.min(16, size * 0.45) : 20, lineHeight: 1.3 }}>{item.emoji}</span>
        {!small && (
          <span className="truncate px-0.5 leading-tight text-center" style={{ fontSize: Math.min(11, size * 0.18), fontWeight: 700 }}>{item.word}</span>
        )}
      </div>
    </div>
  );
}

function ToolItem({ icon, label, count, onClick, size, small }: { icon: React.ReactNode; label: string; count: number; onClick?: () => void; size: number; small: boolean }) {
  const disabled = !onClick || count <= 0;
  return (
    <button onClick={onClick} disabled={disabled}
      className="relative rounded-md border flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
      style={{
        width: size,
        height: size,
        opacity: disabled ? 0.25 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
        color: 'var(--text-secondary)',
      }}
      title={label}>
      <div className="flex flex-col items-center justify-center gap-0">
        {icon}
        {!small && (
          <span className="leading-tight text-center" style={{ fontSize: Math.min(8, size * 0.15), fontWeight: 600, marginTop: 2 }}>{label}</span>
        )}
      </div>
      {count > 0 && (
        <span className="absolute flex items-center justify-center font-mono rounded-full z-10"
          style={{ top: -4, right: -4, fontSize: Math.min(10, size * 0.28), fontWeight: 700, background: 'var(--accent)', color: '#fff', minWidth: Math.min(20, size * 0.5), minHeight: Math.min(20, size * 0.5), padding: '0 4px' }}>
          {count}
        </span>
      )}
    </button>
  );
}
