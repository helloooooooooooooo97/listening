import { usePlaylistStore, queueItemLabel, queueItemSub } from '../stores/playlistStore';
import { useAudioStore } from '../stores/audioStore';
import { HiMusicalNote, HiTrash, HiPlay, HiQueueList, HiClock, HiBookmark, HiPencil, HiTag, HiArrowPath } from 'react-icons/hi2';
import type { AudioClip } from '../types/lesson';

const REPEAT_LABELS: Record<string, string> = {
  sequential: '顺序', 'repeat-all': '全部循环', shuffle: '随机', 'repeat-one': '单曲循环',
};

function ItemIcon({ kind }: { kind: string }) {
  switch (kind) {
    case 'lesson': return <HiMusicalNote size={14} className="text-tertiary" />;
    case 'clip': return <HiBookmark size={14} className="text-amber-500" />;
    case 'sentence': return <HiPencil size={14} className="text-violet-400" />;
    case 'word': return <HiTag size={14} className="text-blue-400" />;
    default: return <HiMusicalNote size={14} className="text-tertiary" />;
  }
}

export default function PlaylistView() {
  const queue = usePlaylistStore(s => s.queue);
  const history = usePlaylistStore(s => s.history);
  const removeFromQueue = usePlaylistStore(s => s.removeFromQueue);
  const clearQueue = usePlaylistStore(s => s.clearQueue);
  const currentIndex = usePlaylistStore(s => s.currentIndex);
  const repeatMode = usePlaylistStore(s => s.repeatMode);
  const cycleRepeatMode = usePlaylistStore(s => s.cycleRepeatMode);
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);

  const handlePlay = (item: typeof queue[number]) => {
    if (item.kind === 'lesson') playLesson(item.lesson);
    else if (item.kind === 'clip') playClip(item.clip, item.lesson ?? null);
    else if (item.kind === 'sentence') {
      const clip: AudioClip = {
        id: `q-${item.lessonId}-s${item.sentenceIndex}`,
        lessonId: item.lessonId, lessonTitle: item.lessonTitle,
        startWordId: '', endWordId: '',
        startTime: item.start, endTime: item.end,
        text: item.text, note: '', color: '#facc15', createdAt: '',
      };
      playClip(clip);
    } else if (item.kind === 'word') {
      const clip: AudioClip = {
        id: `q-${item.lessonId}-w${item.word}`,
        lessonId: item.lessonId, lessonTitle: item.lessonTitle,
        startWordId: '', endWordId: '',
        startTime: Math.max(0, item.start - 2), endTime: item.end + 2,
        text: item.word, note: 'word', color: '#facc15', createdAt: '',
      };
      playClip(clip);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-6 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-primary tracking-tight flex items-center gap-2">
            <HiQueueList size={22} />
            播放队列
          </h1>
          <div className="flex items-center gap-2">
            <button onClick={cycleRepeatMode}
              className="text-xs px-2.5 py-1.5 rounded-lg bg-[var(--bg-tertiary)] text-secondary hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5">
              <HiArrowPath size={12} /> {REPEAT_LABELS[repeatMode]}
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {queue.length === 0 ? (
          <div className="text-center py-16">
            <HiQueueList size={40} className="text-tertiary mx-auto mb-4" />
            <p className="text-tertiary text-sm">播放队列为空</p>
            <p className="text-tertiary text-xs mt-1">点击片段/句子旁的 ➕ 加入队列</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-secondary">即将播放 · {queue.length} 项</p>
              <button onClick={clearQueue}
                className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer">清空队列</button>
            </div>
            <div className="space-y-1">
              {queue.map((item, idx) => {
                const title = queueItemLabel(item);
                const sub = queueItemSub(item);
                const isCurrent = idx === currentIndex;
                return (
                  <div key={idx}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${
                      isCurrent ? 'bg-[var(--bg-active)] ring-1 ring-[var(--accent)]/20' : 'hover:bg-[var(--bg-tertiary)]'
                    }`}>
                    <span className="text-xs text-tertiary w-5 text-right">{idx + 1}</span>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--card-gradient)' }}>
                      <ItemIcon kind={item.kind} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary truncate">{title}</p>
                      <p className="text-xs text-tertiary truncate">{sub}</p>
                    </div>
                    {isCurrent && <span className="w-1 h-6 rounded-full bg-[var(--accent)] flex-shrink-0" />}
                    <button onClick={() => handlePlay(item)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-all cursor-pointer opacity-0 group-hover:opacity-100">
                      <HiPlay size={12} />
                    </button>
                    <button onClick={() => removeFromQueue(idx)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer opacity-0 group-hover:opacity-100">
                      <HiTrash size={12} />
                    </button>
                  </div>
                );
              })}
            </div>

            {history.length > 0 && (
              <>
                <div className="border-t border-[var(--border-secondary)] pt-6 mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <HiClock size={14} className="text-tertiary" />
                    <h2 className="text-sm font-semibold text-secondary">播放历史</h2>
                  </div>
                  <div className="space-y-1">
                    {history.slice(0, 20).map((item, idx) => (
                      <div key={idx}
                        className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer group"
                        onClick={() => handlePlay(item)}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--card-gradient)' }}>
                          <ItemIcon kind={item.kind} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-primary truncate">{queueItemLabel(item)}</p>
                          <p className="text-xs text-tertiary truncate">{queueItemSub(item)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
