import { useState, useEffect, useRef } from 'react';
import { getDictionaryEntry, type WordDictionary } from '../../lib/api';
import Spinner from '../ui/Spinner';

interface TilePopupProps {
  word: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

export default function TilePopup({ word, anchorEl, onClose }: TilePopupProps) {
  const [dict, setDict] = useState<WordDictionary | null>(null);
  const [loading, setLoading] = useState(true);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    getDictionaryEntry(word)
      .then(setDict)
      .catch(() => setDict(null))
      .finally(() => setLoading(false));
  }, [word]);

  // Position popup relative to anchor
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (!anchorEl) return;
    const rect = anchorEl.getBoundingClientRect();
    // Show above the tile by default, with a small gap
    setPos({
      top: rect.top - 8,
      left: rect.left + rect.width / 2,
    });
  }, [anchorEl]);

  if (!anchorEl) return null;

  return (
    <>
      {/* Backdrop to catch click-away */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={popupRef}
        className="fixed z-50 px-3 py-2 rounded-xl shadow-xl border text-xs min-w-[160px] max-w-[220px]"
        style={{
          top: pos.top,
          left: pos.left,
          transform: 'translate(-50%, -100%)',
          background: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
        }}
      >
        {loading ? (
          <div className="flex items-center gap-2 py-1">
            <Spinner size={12} />
            <span className="text-tertiary">查询中...</span>
          </div>
        ) : dict ? (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-primary text-sm">{word}</span>
              {dict.tags.length > 0 && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 font-medium">{dict.tags[0]}</span>
              )}
            </div>
            {dict.pronunciation && (
              <p className="text-xs text-tertiary font-mono">/{dict.pronunciation}/</p>
            )}
            {(dict.partOfSpeech || dict.definition) && (
              <p className="text-xs text-secondary leading-relaxed">
                {dict.partOfSpeech && <span className="italic mr-1">{dict.partOfSpeech}</span>}
                {dict.definition}
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-tertiary py-1">暂无释义</p>
        )}
      </div>
    </>
  );
}
