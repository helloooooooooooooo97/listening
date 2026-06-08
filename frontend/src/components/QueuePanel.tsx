import { useEffect, useRef } from 'react';
import { HiXMark, HiMusicalNote, HiBookmark, HiClock, HiTag, HiTrash, HiArrowPath, HiQueueList } from 'react-icons/hi2';
import { usePlaylistStore, queueItemLabel, queueItemSub, type QueueItem } from '../stores/playlistStore';
import { useAudioStore } from '../stores/audioStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const REPEAT_LABELS: Record<string, string> = {
  sequential: '顺序', 'repeat-all': '全部循环', shuffle: '随机', 'repeat-one': '单曲循环',
};

function ItemIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'lesson': return <HiMusicalNote size={14} className="text-tertiary" />;
    case 'clip': return <HiBookmark size={14} className="text-amber-500" />;
    case 'sentence': return <HiClock size={14} className="text-violet-400" />;
    case 'word': return <HiTag size={14} className="text-blue-400" />;
    default: return <HiMusicalNote size={14} className="text-tertiary" />;
  }
}

export default function QueuePanel({ open, onClose }: Props) {
  const queue = usePlaylistStore(s => s.queue);
  const history = usePlaylistStore(s => s.history);
  const currentIndex = usePlaylistStore(s => s.currentIndex);
  const repeatMode = usePlaylistStore(s => s.repeatMode);
  const removeFromQueue = usePlaylistStore(s => s.removeFromQueue);
  const clearQueue = usePlaylistStore(s => s.clearQueue);
  const setCurrentIndex = usePlaylistStore(s => s.setCurrentIndex);
  const cycleRepeatMode = usePlaylistStore(s => s.cycleRepeatMode);
  const playQueueItem = useAudioStore(s => s.playQueueItem);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // Close on click outside panel
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open, onClose]);

  const handlePlay = (item: QueueItem, idx?: number) => {
    if (idx !== undefined) setCurrentIndex(idx);
    playQueueItem(item);
  };

  return (
    <>
      {/* Backdrop — only on mobile */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      )}

      {/* Panel */}
      <div ref={panelRef}
        className={`fixed top-0 right-0 z-50 h-full w-full md:w-96 bg-[var(--bg-primary)] border-l border-[var(--border-primary)] shadow-2xl transition-transform duration-300 ease-out flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom, 0px))' }}>

        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-12 pb-4 border-b border-[var(--border-secondary)]">
          <div className="flex items-center gap-2">
            <HiQueueList size={18} className="text-primary" />
            <h2 className="text-base font-bold text-primary">播放队列</h2>
            <span className="text-xs text-tertiary font-normal">{queue.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={cycleRepeatMode}
              className="text-[10px] px-2 py-1 rounded-lg bg-[var(--bg-tertiary)] text-secondary hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
              <HiArrowPath size={10} /> {REPEAT_LABELS[repeatMode]}
            </button>
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
              <HiXMark size={16} />
            </button>
          </div>
        </div>

        {/* Queue items */}
        <div className="flex-1 overflow-y-auto">
          {queue.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <HiQueueList size={36} className="text-tertiary mb-4" />
              <p className="text-sm text-tertiary">队列为空</p>
              <p className="text-xs text-tertiary mt-1">从合集或片段中添加内容</p>
            </div>
          ) : (
            <div className="py-2">
              {queue.length > 0 && (
                <div className="flex items-center justify-between px-5 py-2">
                  <p className="text-[10px] font-medium text-tertiary uppercase tracking-wider">即将播放</p>
                  <button onClick={clearQueue}
                    className="text-[10px] text-tertiary hover:text-secondary transition-colors cursor-pointer flex items-center gap-1">
                    <HiTrash size={10} /> 清空
                  </button>
                </div>
              )}
              {queue.map((item, idx) => {
                const title = queueItemLabel(item);
                const sub = queueItemSub(item);
                const isCurrent = idx === currentIndex;
                return (
                  <div key={`${item.kind}-${idx}`}
                    className={`group flex items-center gap-3 px-5 py-2.5 transition-colors cursor-pointer ${
                      isCurrent ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'
                    }`}
                    onClick={() => handlePlay(item, idx)}>
                    <span className="text-[10px] text-tertiary font-mono w-4 text-right flex-shrink-0">{idx + 1}</span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--card-gradient)' }}>
                      <ItemIcon kind={item.kind} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-primary truncate">{title}</p>
                      <p className="text-[10px] text-tertiary truncate">{sub}</p>
                    </div>
                    {isCurrent && <span className="w-1 h-5 rounded-full bg-[var(--accent)] flex-shrink-0" />}
                    <button onClick={e => { e.stopPropagation(); removeFromQueue(idx); }}
                      className="w-6 h-6 rounded-full flex items-center justify-center text-tertiary hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer opacity-0 group-hover:opacity-100 flex-shrink-0">
                      <HiTrash size={10} />
                    </button>
                  </div>
                );
              })}

              {history.length > 0 && (
                <>
                  <div className="border-t border-[var(--border-secondary)] mt-4 pt-4 px-5 pb-2">
                    <p className="text-[10px] font-medium text-tertiary uppercase tracking-wider">播放历史</p>
                  </div>
                  {history.slice(0, 30).map((item, idx) => (
                    <div key={`h-${idx}`}
                      className="group flex items-center gap-3 px-5 py-2 hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                      onClick={() => handlePlay(item)}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--card-gradient)' }}>
                        <ItemIcon kind={item.kind} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-primary truncate">{queueItemLabel(item)}</p>
                        <p className="text-[10px] text-tertiary truncate">{queueItemSub(item)}</p>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
