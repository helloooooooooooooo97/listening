import { useState, useCallback } from 'react';
import { HiHeart } from 'react-icons/hi2';

interface Props {
  active: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
}

export default function HeartButton({ active, onToggle, size = 14, className = '' }: Props) {
  const [burst, setBurst] = useState(false);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle();
    if (!active) {
      setBurst(true);
      setTimeout(() => setBurst(false), 500);
    }
  }, [active, onToggle]);

  return (
    <button
      onClick={handleClick}
      className={`transition-colors cursor-pointer select-none ${burst ? 'animate-heart-burst' : ''} ${active ? 'text-[var(--accent)]' : 'text-tertiary hover:text-secondary'} ${className}`}
      title={active ? '取消收藏' : '收藏'}
    >
      <HiHeart size={size} />
    </button>
  );
}
