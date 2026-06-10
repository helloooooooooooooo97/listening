interface GameTileProps {
  word: string;
  emoji: string;
  inDegree: number;
  isClickable: boolean;
  onClick: () => void;
}

const CELL = 64;

export default function GameTile({ word, emoji, inDegree, isClickable, onClick }: GameTileProps) {

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
      <span style={{ fontSize: 18, lineHeight: 1.3 }}>{emoji}</span>
      <span
        className="truncate text-center select-none leading-tight"
        style={{ fontSize: 10, fontWeight: 700, maxWidth: CELL - 8 }}
      >
        {word}
      </span>
    </div>
  );

  if (!isClickable) {
    return (
      <div
        className="relative rounded-md border overflow-hidden flex items-center justify-center pointer-events-none select-none"
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
    <button
      onClick={onClick}
      className="relative rounded-md border overflow-hidden flex items-center justify-center hover:brightness-110 active:scale-90 transition-all duration-150 cursor-pointer select-none"
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
  );
}
