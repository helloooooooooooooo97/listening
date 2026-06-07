import { usePlaylistStore } from '../stores/playlistStore';
import { useAudioStore } from '../stores/audioStore';
import { HiMusicalNote, HiTrash, HiPlay, HiQueueList, HiClock, HiArrowUp, HiArrowDown } from 'react-icons/hi2';

export default function PlaylistView() {
  const queue = usePlaylistStore(s => s.queue);
  const history = usePlaylistStore(s => s.history);
  const removeFromQueue = usePlaylistStore(s => s.removeFromQueue);
  const playNext = usePlaylistStore(s => s.playNext);
  const clearQueue = usePlaylistStore(s => s.clearQueue);
  const currentIndex = usePlaylistStore(s => s.currentIndex);
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-primary tracking-tight flex items-center gap-2">
          <HiQueueList size={22} />
          播放队列
        </h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {/* Current queue */}
        {queue.length === 0 ? (
          <div className="text-center py-16">
            <HiQueueList size={40} className="text-tertiary mx-auto mb-4" />
            <p className="text-tertiary text-sm">播放队列为空</p>
            <p className="text-tertiary text-xs mt-1">在音频上点击「添加到队列」</p>
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
                const title = item.kind === 'lesson' ? item.lesson.title : item.clip.text;
                const sub = item.kind === 'lesson' ? item.lesson.subtitle : item.clip.lessonTitle;
                const Icon = item.kind === 'lesson' ? HiMusicalNote : HiPlay;
                const isCurrent = idx === currentIndex;
                return (
                  <div key={idx}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors group ${
                      isCurrent ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-tertiary)]'
                    }`}>
                    <span className="text-xs text-tertiary w-5 text-right">{idx + 1}</span>
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--card-gradient)' }}>
                      <Icon size={14} className="text-tertiary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary truncate">{title}</p>
                      <p className="text-xs text-tertiary truncate">{sub}</p>
                    </div>
                    <button onClick={() => {
                      if (item.kind === 'lesson') playLesson(item.lesson);
                      else playClip(item.clip, item.lesson ?? null);
                    }}
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

            {/* Play history */}
            {history.length > 0 && (
              <>
                <div className="border-t border-[var(--border-secondary)] pt-6 mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <HiClock size={14} className="text-tertiary" />
                    <h2 className="text-sm font-semibold text-secondary">播放历史</h2>
                  </div>
                  <div className="space-y-1">
                    {history.slice(0, 20).map((item, idx) => {
                      const title = item.kind === 'lesson' ? item.lesson.title : item.clip.text;
                      const sub = item.kind === 'lesson' ? item.lesson.subtitle : item.clip.lessonTitle;
                      const Icon = item.kind === 'lesson' ? HiMusicalNote : HiPlay;
                      return (
                        <div key={idx}
                          className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer group"
                          onClick={() => {
                            if (item.kind === 'lesson') playLesson(item.lesson);
                            else playClip(item.clip, item.lesson ?? null);
                          }}>
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--card-gradient)' }}>
                            <Icon size={12} className="text-tertiary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-primary truncate">{title}</p>
                            <p className="text-xs text-tertiary truncate">{sub}</p>
                          </div>
                        </div>
                      );
                    })}
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
