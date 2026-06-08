import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HiArrowLeft, HiPlay, HiMusicalNote, HiBookmark, HiClock, HiTag, HiTrash, HiArrowPath, HiQueueList, HiPlusCircle } from 'react-icons/hi2';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useAudioStore } from '../stores/audioStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useToastStore } from '../stores/toastStore';
import { getLessonById } from '../lib/api';
import type { AudioClip, CollectionItem } from '../types/lesson';
import type { QueueItem } from '../stores/playlistStore';

const TYPE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; label: string }> = {
  audio: { icon: HiMusicalNote, label: '音频' },
  clip: { icon: HiBookmark, label: '片段' },
  sentence: { icon: HiClock, label: '句子' },
  word: { icon: HiTag, label: '单词' },
};

export default function CollectionDetailView() {
  const location = useLocation();
  const navigate = useNavigate();
  const collectionId = Number(location.pathname.split('/')[2]);
  const current = useCollectionsStore(s => s.current);
  const loading = useCollectionsStore(s => s.loading);
  const error = useCollectionsStore(s => s.error);
  const loadCollection = useCollectionsStore(s => s.loadCollection);
  const refresh = useCollectionsStore(s => s.refresh);
  const removeItem = useCollectionsStore(s => s.removeItem);
  const clearItems = useCollectionsStore(s => s.clearItems);
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);
  const addToQueue = usePlaylistStore(s => s.addToQueue);
  const addToast = useToastStore(s => s.addToast);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (collectionId) {
      loadCollection(collectionId);
    }
  }, [collectionId, loadCollection]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh(collectionId);
    setTimeout(() => setRefreshing(false), 500);
  };

  const handlePlayItem = async (item: CollectionItem) => {
    try {
      if (item.item_type === 'audio') {
        const lesson = await getLessonById(item.lesson_id || item.item_ref);
        playLesson(lesson);
        addToast(`正在播放: ${item.title}`, 'info');
      } else if (item.item_type === 'clip') {
        const lesson = await getLessonById(item.lesson_id);
        const clip: AudioClip = {
          id: item.item_ref,
          lessonId: item.lesson_id,
          lessonTitle: item.lesson_title || item.subtitle,
          startWordId: '', endWordId: '',
          startTime: item.start_time,
          endTime: item.end_time || item.start_time + 10,
          text: item.title,
          note: item.subtitle,
          color: '#facc15',
          createdAt: item.added_at,
        };
        playClip(clip, lesson);
      } else if (item.item_type === 'sentence') {
        const lesson = await getLessonById(item.lesson_id);
        const clip: AudioClip = {
          id: `col-s-${item.id}`,
          lessonId: item.lesson_id,
          lessonTitle: item.lesson_title || item.subtitle,
          startWordId: '', endWordId: '',
          startTime: item.start_time,
          endTime: item.end_time || item.start_time + 5,
          text: item.title,
          note: '',
          color: '#8b5cf6',
          createdAt: item.added_at,
        };
        playClip(clip, lesson);
      } else if (item.item_type === 'word') {
        addToast('单词暂不支持直接播放', 'info');
      }
    } catch {
      addToast('播放失败', 'error');
    }
  };

  const handlePlayAll = async () => {
    if (!current?.items.length) return;

    const queueItems: QueueItem[] = [];
    const lessonCache: Record<string, import('../types/lesson').ListeningLesson> = {};
    const fetchLesson = async (lessonId: string) => {
      if (!lessonCache[lessonId]) {
        lessonCache[lessonId] = await getLessonById(lessonId);
      }
      return lessonCache[lessonId];
    };

    for (const item of current.items) {
      try {
        if (item.item_type === 'audio') {
          const lessonId = item.lesson_id || item.item_ref;
          const lesson = await fetchLesson(lessonId);
          queueItems.push({ kind: 'lesson', lesson });
        } else if (item.item_type === 'sentence') {
          const sentenceIndex = parseInt(item.item_ref.split(':').pop() || '0', 10);
          queueItems.push({
            kind: 'sentence',
            lessonId: item.lesson_id,
            lessonTitle: item.lesson_title || item.subtitle,
            sentenceIndex,
            start: item.start_time,
            end: item.end_time,
            text: item.title,
          });
        } else if (item.item_type === 'clip') {
          const clip: AudioClip = {
            id: item.item_ref,
            lessonId: item.lesson_id,
            lessonTitle: item.lesson_title || item.subtitle,
            startWordId: '', endWordId: '',
            startTime: item.start_time,
            endTime: item.end_time || item.start_time + 10,
            text: item.title,
            note: item.subtitle,
            color: '#facc15',
            createdAt: item.added_at,
          };
          queueItems.push({ kind: 'clip', clip, lesson: null });
        }
      } catch {
        // skip items that fail to resolve
      }
    }

    if (queueItems.length === 0) {
      addToast('没有可播放的条目', 'info');
      return;
    }

    // Fill queue and play first item
    const playlistStore = usePlaylistStore.getState();
    playlistStore.clearQueue();
    playlistStore.addAllToQueue(queueItems);
    // Mark currentIndex = 0 so playNext() advances to index 1 when first item ends
    playlistStore.setCurrentIndex(0);

    useAudioStore.getState().playQueueItem(queueItems[0]);

    addToast(`即将播放 ${queueItems.length} 项`, 'success');
  };

  const handleRemoveItem = async (item: CollectionItem) => {
    await removeItem(collectionId, item.id);
    addToast('已移除', 'info');
  };

  const handleClearItems = async () => {
    await clearItems(collectionId);
    addToast('已清空合集', 'info');
  };

  if (loading && !current) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-primary)]">
        <div className="flex items-center justify-center flex-1">
          <div className="w-5 h-5 border-2 border-white/10 border-t-[var(--accent)] rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !current) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-primary)]">
        <div className="px-8 pt-10 pb-4">
          <button onClick={() => navigate('/collections')}
            className="flex items-center gap-1.5 text-sm text-tertiary hover:text-secondary transition-colors cursor-pointer">
            <HiArrowLeft size={14} /> 返回合集
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-tertiary text-sm">加载失败: {error}</p>
        </div>
      </div>
    );
  }

  if (!current) return null;

  const Icon = TYPE_META[current.icon as keyof typeof TYPE_META]?.icon || HiQueueList;
  const isDynamic = current.is_dynamic;
  const items = current.items || [];

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-8 pt-10 pb-4 border-b border-[var(--border-secondary)]">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate('/collections')}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
            <HiArrowLeft size={16} />
          </button>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${current.color}20` }}>
            <Icon size={26} style={{ color: current.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold text-primary tracking-tight">{current.name}</h1>
            <p className="text-sm text-tertiary mt-1">
              {isDynamic ? '智能合集 · 数据自动更新' : '自定义合集'}
              {' · '}{items.length} 个条目
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isDynamic && (
              <button onClick={handleRefresh}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-tertiary hover:text-secondary hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer ${refreshing ? 'animate-spin' : ''}`}
                title="刷新">
                <HiArrowPath size={12} /> 刷新
              </button>
            )}
            {!isDynamic && items.length > 0 && (
              <button onClick={handleClearItems}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-tertiary hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer">
                <HiTrash size={12} /> 清空
              </button>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <button onClick={handlePlayAll}
            className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold on-accent transition-all hover:opacity-90 cursor-pointer"
            style={{ background: current.color }}>
            <HiPlay size={16} /> 播放全部 ({items.length})
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <Icon size={40} className="text-tertiary mx-auto mb-4" />
            <p className="text-tertiary text-sm">
              {isDynamic ? '暂无数据，开始学习后会自动填充' : '合集为空'}
            </p>
            {isDynamic && (
              <button onClick={handleRefresh}
                className="mt-3 text-xs px-3 py-1.5 rounded-lg text-tertiary hover:text-secondary hover:bg-[var(--bg-tertiary)] transition-colors cursor-pointer flex items-center gap-1.5 mx-auto">
                <HiArrowPath size={11} /> 立即刷新
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1 max-w-3xl">
            {items.map((item, idx) => {
              const meta = TYPE_META[item.item_type] || TYPE_META.audio;
              const ItemIcon = meta.icon;
              return (
                <div key={item.id || idx}
                  className="group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors hover:bg-[var(--bg-tertiary)] cursor-pointer"
                  onClick={() => handlePlayItem(item)}>
                  <span className="text-xs text-tertiary tabular-nums w-6 text-right">{idx + 1}</span>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--card-gradient)' }}>
                    <ItemIcon size={14} className="text-tertiary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{item.title || item.item_ref}</p>
                    <p className="text-xs text-tertiary truncate">
                      {item.subtitle || item.lesson_title || meta.label}
                      {item.start_time > 0 && ` · ${Math.floor(item.start_time / 60)}:${Math.floor(item.start_time % 60).toString().padStart(2, '0')}`}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); addToQueue({ kind: item.item_type === 'audio' ? 'lesson' : 'clip', ...item } as any); addToast('已加入队列', 'success'); }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-blue-400 hover:bg-[var(--bg-hover)] transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                    title="加入队列">
                    <HiPlusCircle size={12} />
                  </button>
                  {!isDynamic && (
                    <button onClick={e => { e.stopPropagation(); handleRemoveItem(item); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-tertiary hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      title="移除">
                      <HiTrash size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
