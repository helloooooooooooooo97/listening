import { useState } from 'react';
import type { AudioClip } from '../types/lesson';

interface EditClipModalProps {
  clip: AudioClip;
  onSave: (id: string, data: { note: string; color: string }) => void;
  onClose: () => void;
}

const CLIP_COLORS = ['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7'];

export default function EditClipModal({ clip, onSave, onClose }: EditClipModalProps) {
  const [note, setNote] = useState(clip.note || '');
  const [color, setColor] = useState(clip.color || '#facc15');

  const handleSave = () => {
    onSave(clip.id, { note: note.trim(), color });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-sm rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden animate-scale-in"
        style={{ background: 'var(--bg-secondary)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-secondary)]">
          <h3 className="text-sm font-bold text-primary">编辑片段</h3>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer text-sm">&times;</button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-xs text-secondary leading-relaxed line-clamp-2">"{clip.text}"</p>
          <div>
            <label className="text-[11px] text-tertiary font-medium block mb-1.5">备注</label>
            <input type="text" value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              placeholder="添加备注..."
              className="w-full text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3.5 py-2.5 text-primary outline-none focus:ring-1 focus:ring-[var(--accent)]/30 placeholder:text-tertiary" />
          </div>
          <div>
            <label className="text-[11px] text-tertiary font-medium block mb-1.5">颜色</label>
            <div className="flex items-center gap-2">
              {CLIP_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`rounded-full transition-all cursor-pointer hover:scale-125 ${color === c ? 'w-7 h-7 shadow-sm ring-2 ring-white/30' : 'w-6 h-6 opacity-60 hover:opacity-100'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleSave}
              className="flex-1 text-sm py-2.5 rounded-xl bg-[var(--accent)] on-accent font-medium hover:bg-[var(--accent-hover)] transition-colors cursor-pointer">
              保存
            </button>
            <button onClick={onClose}
              className="flex-1 text-sm py-2.5 rounded-xl bg-[var(--bg-tertiary)] text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
