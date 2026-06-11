import { useMemo } from 'react';
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

const SLOT = 72;

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

  return (
    <div className="w-full flex justify-center">
      <div className={`flex gap-1 p-2 rounded-xl border transition-colors duration-300 items-center
        ${isAlmostFull ? 'border-red-500/20 bg-red-500/5' : ''}
        ${lastMatchSuccess ? 'border-emerald-500/40 bg-emerald-500/10' : ''}`}
        style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-tertiary)' }}>
        {/* Slot items */}
        {Array.from({ length: capacity }, (_, i) => {
          const item = slot[i] ?? null;
          const isGlowing = item ? glowWords.has(item.word) : false;
          return <SlotItem key={i} item={item} isGlowing={isGlowing} />;
        })}

        {/* Separator */}
        <div style={{ width: 1, height: 40, background: 'var(--border-secondary)', margin: '0 4px' }} />

        {/* Tool items */}
        <ToolItem icon={<HiArrowPath size={14} />} label="洗牌" count={tools?.shuffle ?? 0} onClick={onShuffle} />
        <ToolItem icon={<HiArrowUturnLeft size={14} />} label="撤回" count={tools?.undo ?? 0} onClick={onUndo} />
        <ToolItem icon={<HiTrash size={14} />} label="移出" count={tools?.remove3 ?? 0} onClick={onRemove3} />
      </div>
    </div>
  );
}

function SlotItem({ item, isGlowing }: { item: TileData | null; isGlowing: boolean }) {
  if (!item) {
    return (
      <div
        className="rounded-md border overflow-hidden flex items-center justify-center"
        style={{
          width: SLOT,
          height: SLOT,
          borderStyle: 'dashed',
          borderColor: 'var(--border-secondary)',
        }}
      />
    );
  }

  return (
    <div
      className={`rounded-md border overflow-hidden flex items-center justify-center transition-all duration-200 ${
        isGlowing ? 'ring-1 ring-amber-400/40' : ''
      }`}
      style={{
        width: SLOT,
        height: SLOT,
        background: 'var(--bg-secondary)',
        borderColor: isGlowing ? 'rgba(251,191,36,0.3)' : 'var(--border-primary)',
        color: 'var(--text-primary)',
        boxShadow: isGlowing ? 'inset 0 0 12px rgba(251,191,36,0.15)' : 'none',
      }}
    >
      <div className="flex flex-col items-center justify-center gap-0">
        <span style={{ fontSize: 20, lineHeight: 1.3 }}>{item.emoji}</span>
        <span className="truncate px-0.5 leading-tight text-center" style={{ fontSize: 11, fontWeight: 700 }}>{item.word}</span>
      </div>
    </div>
  );
}

function ToolItem({ icon, label, count, onClick }: { icon: React.ReactNode; label: string; count: number; onClick?: () => void }) {
  const disabled = !onClick || count <= 0;
  return (
    <button onClick={onClick} disabled={disabled}
      className="relative rounded-md border flex items-center justify-center transition-colors cursor-pointer"
      style={{
        width: SLOT,
        height: SLOT,
        opacity: disabled ? 0.25 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-primary)',
        color: 'var(--text-secondary)',
      }}
      title={label}>
      <div className="flex flex-col items-center justify-center gap-0">
        {icon}
        <span className="leading-tight text-center" style={{ fontSize: 8, fontWeight: 600, marginTop: 2 }}>{label}</span>
      </div>
      {count > 0 && (
        <span className="absolute flex items-center justify-center font-mono rounded-full z-10"
          style={{ top: -4, right: -4, fontSize: 10, fontWeight: 700, background: 'var(--accent)', color: '#fff', minWidth: 20, minHeight: 20, padding: '0 4px' }}>
          {count}
        </span>
      )}
    </button>
  );
}
