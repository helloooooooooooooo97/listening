import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HiArrowLeft, HiPlay, HiMusicalNote, HiBookmark, HiClock, HiTag, HiTrash, HiQueueList, HiPlusCircle, HiAdjustmentsHorizontal } from 'react-icons/hi2';
import { useCollectionsStore } from '../stores/collectionsStore';
import { useAudioStore } from '../stores/audioStore';
import { useClipsStore } from '../stores/clipsStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useToastStore } from '../stores/toastStore';
import { getLessonById } from '../lib/api';
import { collectionItemToQueueItem, collectionItemsToQueueItems } from '../lib/collectionQueue';
import type { AudioClip, CollectionItem } from '../types/lesson';

const TYPE_META: Record<string, { icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>; label: string }> = {
  audio: { icon: HiMusicalNote, label: '音频' },
  clip: { icon: HiBookmark, label: '片段' },
  sentence: { icon: HiClock, label: '句子' },
  word: { icon: HiTag, label: '单词' },
};

function getExtraColor(extraData?: string): string {
  if (!extraData) return '';
  try {
    const parsed = JSON.parse(extraData);
    return typeof parsed?.color === 'string' ? normalizeColor(parsed.color) : '';
  } catch {
    return '';
  }
}

function normalizeColor(color?: string): string {
  const value = color?.trim().toLowerCase() || '';
  return value.length === 9 && value.endsWith('ff') ? value.slice(0, 7) : value;
}

function getCollectionClipColor(item: CollectionItem, allClips: AudioClip[]): string {
  // item_ref may be a number (from dynamic queries like all_clips) or a string
  // clip IDs in the store are always strings — coerce to compare correctly
  return normalizeColor(allClips.find(c => c.id === String(item.item_ref))?.color)
    || getExtraColor(item.extra_data);
}

export default function CollectionDetailView() {
  const location = useLocation();
  const navigate = useNavigate();
  const collectionId = Number(location.pathname.split('/')[2]);
  const current = useCollectionsStore(s => s.current);
  const loading = useCollectionsStore(s => s.loading);
  const error = useCollectionsStore(s => s.error);
  const loadCollection = useCollectionsStore(s => s.loadCollection);
  const removeItem = useCollectionsStore(s => s.removeItem);
  const clearItems = useCollectionsStore(s => s.clearItems);
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);
  const addToQueue = usePlaylistStore(s => s.addToQueue);
  const addToast = useToastStore(s => s.addToast);
  const allClips = useClipsStore(s => s.clips ?? []);
  const [playConfigOpen, setPlayConfigOpen] = useState(false);
  const [playTypes, setPlayTypes] = useState<Set<string>>(new Set(['audio', 'clip', 'sentence', 'word']));
  const [playShuffle, setPlayShuffle] = useState(false);
  const [playColors, setPlayColors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (collectionId) {
      loadCollection(collectionId);
    }
  }, [collectionId, loadCollection]);

  // Close play config panel on outside click
  useEffect(() => {
    if (!playConfigOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.play-config-area')) setPlayConfigOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [playConfigOpen]);

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
    if (filteredItems.length === 0) {
      addToast('没有可播放的条目', 'info');
      return;
    }

    const itemsToPlay = playShuffle
      ? [...filteredItems].sort(() => Math.random() - 0.5)
      : filteredItems;
    const queueItems = await collectionItemsToQueueItems(itemsToPlay);

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

  const handleAddItemToQueue = async (item: CollectionItem) => {
    try {
      const queueItem = await collectionItemToQueueItem(item);
      if (!queueItem) {
        addToast('这个条目暂不能播放', 'info');
        return;
      }
      addToQueue(queueItem);
      addToast('已加入队列', 'success');
    } catch {
      addToast('加入队列失败', 'error');
    }
  };

  const handleClearItems = async () => {
    await clearItems(collectionId);
    addToast('已清空合集', 'info');
  };

  const items = current?.items || [];

  // Filtered item count based on play config
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (!playTypes.has(item.item_type)) return false;
      if (item.item_type === 'clip' && playColors.size > 0 && playColors.size < COLOR_HEX.length) {
        const clipColor = getCollectionClipColor(item, allClips);
        return playColors.has(clipColor);
      }
      return true;
    });
  }, [items, playTypes, playColors, allClips]);
  const filteredCount = filteredItems.length;

  if (loading && !current) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-primary)]">
        <div className="flex items-center justify-center flex-1">
          <div className="w-5 h-5 border-2 border-white/10 border-t-[var(--accent)] rounded-full" />
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
            {items.length > 0 && (
              <>
                <button onClick={handlePlayAll}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold on-accent transition-all hover:opacity-90 cursor-pointer shadow-lg shadow-[var(--accent)]/20"
                  style={{ background: current.color }}>
                  <HiPlay size={14} /> 播放全部
                </button>
                <div className="relative play-config-area">
                  <button onClick={() => setPlayConfigOpen(v => !v)}
                    className="relative w-9 h-9 rounded-xl flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer"
                    title="筛选设置">
                    <HiAdjustmentsHorizontal size={18} />
                    <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full text-[10px] font-semibold flex items-center justify-center px-1 transition-all ${filteredCount < items.length ? 'bg-[var(--accent)] on-accent scale-100' : 'bg-[var(--bg-tertiary)] text-tertiary scale-90'}`}>
                      {filteredCount}
                    </span>
                  </button>
                  {playConfigOpen && (
                    <PlayConfigPanel
                      items={items}
                      playTypes={playTypes}
                      setPlayTypes={setPlayTypes}
                      playShuffle={playShuffle}
                      setPlayShuffle={setPlayShuffle}
                      playColors={playColors}
                      setPlayColors={setPlayColors}
                      allClips={allClips}
                      onStart={() => { setPlayConfigOpen(false); handlePlayAll(); }}
                      accentColor={current.color}
                    />
                  )}
                </div>
              </>
            )}
            {!isDynamic && items.length > 0 && (
              <button onClick={handleClearItems}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-tertiary hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer">
                <HiTrash size={12} /> 清空
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-y-auto px-8 py-4">
        {items.length === 0 ? (
          <div className="text-center py-16">
            <Icon size={40} className="text-tertiary mx-auto mb-4" />
            <p className="text-tertiary text-sm">
              {isDynamic ? '暂无数据，开始学习后会自动填充' : '合集为空'}
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-w-3xl">
            {items.map((item, idx) => {
              const meta = TYPE_META[item.item_type] || TYPE_META.audio;
              const ItemIcon = meta.icon;
              const itemColor = item.item_type === 'clip' ? getCollectionClipColor(item, allClips) : '';
              return (
                <div key={item.id || idx}
                  className="group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors hover:bg-[var(--bg-tertiary)] cursor-pointer"
                  onClick={() => handlePlayItem(item)}>
                  <span className="text-xs text-tertiary tabular-nums w-6 text-right">{idx + 1}</span>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: itemColor ? itemColor + '30' : 'var(--card-gradient)' }}>
                    <ItemIcon size={14} style={{ color: itemColor || undefined }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{item.title || item.item_ref}</p>
                    <p className="text-xs text-tertiary truncate">
                      {item.subtitle || item.lesson_title || meta.label}
                      {item.start_time > 0 && ` · ${Math.floor(item.start_time / 60)}:${Math.floor(item.start_time % 60).toString().padStart(2, '0')}`}
                    </p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); handleAddItemToQueue(item); }}
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

/* ── Play Config Panel ── */
const COLOR_HEX = ['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7'];

function PlayConfigPanel({
  items,
  playTypes,
  setPlayTypes,
  playShuffle,
  setPlayShuffle,
  playColors,
  setPlayColors,
  allClips,
  onStart,
  accentColor,
}: {
  items: CollectionItem[];
  playTypes: Set<string>;
  setPlayTypes: (fn: (prev: Set<string>) => Set<string>) => void;
  playShuffle: boolean;
  setPlayShuffle: (v: boolean) => void;
  playColors: Set<string>;
  setPlayColors: (fn: (prev: Set<string>) => Set<string>) => void;
  allClips: AudioClip[];
  onStart: () => void;
  accentColor: string;
}) {
  const filteredCount = items.filter(item => {
    if (!playTypes.has(item.item_type)) return false;
    if (item.item_type === 'clip' && playColors.size > 0 && playColors.size < COLOR_HEX.length) {
      const clipColor = getCollectionClipColor(item, allClips);
      return playColors.has(clipColor);
    }
    return true;
  }).length;
  const hasClips = items.some(i => i.item_type === 'clip');

  return (
    <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden z-50 animate-fade-in"
      style={{ background: 'var(--bg-secondary)' }}>
      <div className="px-5 py-4 space-y-4">
        <p className="text-xs font-semibold text-primary tracking-wide">播放配置</p>

        {/* Type filters */}
        <div>
          <p className="text-[11px] text-tertiary font-medium mb-2">条目类型</p>
          <div className="flex flex-wrap gap-1.5">
            {(['audio', 'clip', 'sentence', 'word'] as const).map(type => {
              const meta = TYPE_META[type as keyof typeof TYPE_META] || TYPE_META.audio;
              const TypeIcon = meta.icon;
              const active = playTypes.has(type);
              return (
                <button key={type} onClick={() => setPlayTypes(prev => {
                  const next = new Set(prev);
                  if (next.has(type)) next.delete(type); else next.add(type);
                  return next;
                })}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    active ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                  }`}>
                  <TypeIcon size={12} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Clip color filters */}
        {hasClips && (
          <div>
            <p className="text-[11px] text-tertiary font-medium mb-2">片段颜色</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button onClick={() => { if (playColors.size > 0) setPlayColors(() => new Set()); else setPlayColors(() => new Set(COLOR_HEX)); }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                  playColors.size === 0 || playColors.size === COLOR_HEX.length ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                }`}>
                全部
              </button>
              {COLOR_HEX.map(c => (
                <button key={c} onClick={() => setPlayColors(prev => {
                  const next = new Set(prev);
                  if (next.has(c)) next.delete(c); else next.add(c);
                  return next;
                })}
                  className={`w-6 h-6 rounded-full transition-all cursor-pointer hover:scale-125 ${
                    playColors.has(c) || playColors.size === 0
                      ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-[var(--bg-secondary)]'
                      : 'opacity-40 hover:opacity-80'
                  }`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
        )}

        {/* Shuffle toggle */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-secondary">随机播放</span>
          <button onClick={() => setPlayShuffle(!playShuffle)}
            className={`w-9 h-5 rounded-full transition-colors cursor-pointer relative ${
              playShuffle ? 'bg-[var(--accent)]' : 'bg-[var(--bg-tertiary)]'
            }`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
              playShuffle ? 'translate-x-[18px]' : 'translate-x-[2px]'
            }`} />
          </button>
        </div>

        {/* Start button */}
        <button onClick={onStart}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold on-accent transition-all hover:opacity-90 cursor-pointer"
          style={{ background: accentColor }}>
          <HiPlay size={14} />
          开始播放 ({filteredCount})
        </button>
      </div>
    </div>
  );
}
