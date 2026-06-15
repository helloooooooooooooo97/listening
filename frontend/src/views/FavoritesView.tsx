import { useEffect, useMemo, useState } from 'react';
import { HiHeart, HiPlay, HiMusicalNote, HiBookmark, HiTag, HiCheckCircle, HiTrash } from 'react-icons/hi2';

function fmtDate(ts: number | string | undefined) {
  if (!ts) return '';
  const d = typeof ts === 'number' ? new Date(ts * 1000) : new Date(ts);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}
import { useAudioStore } from '../stores/audioStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useClipsStore } from '../stores/clipsStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useToastStore } from '../stores/toastStore';
import { removeFavorite, getLessonById } from '../lib/api';
import { useClipAnalysis } from '../hooks/useClipAnalysis';
import ClipActions from '../components/ClipActions';
import ClipAnalysisModal from '../components/ClipAnalysisModal';
import type { AudioClip } from '../types/lesson';

const TYPE_META = {
  audio: { icon: HiMusicalNote, gradient: 'var(--card-gradient)', label: '音频' },
  clip: { icon: HiBookmark, gradient: 'var(--clip-gradient)', label: '片段' },
  word: { icon: HiTag, gradient: 'var(--ielts-gradient)', label: '单词' },
} as const;

export default function FavoritesView() {
  const items = useFavoritesStore(s => s.items);
  const loadFavorites = useFavoritesStore(s => s.loadFavorites);
  const loaded = useFavoritesStore(s => s.loaded);
  const toggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const clips = useClipsStore(s => s.clips);
  const updateClip = useClipsStore(s => s.updateClip);
  const removeClip = useClipsStore(s => s.removeClip);
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);
  const addToast = useToastStore(s => s.addToast);
  const addToQueue = usePlaylistStore(s => s.addToQueue);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const favClips = useMemo(() => {
    return items.filter(i => i.item_type === 'clip').map(i => clips.find(c => c.id === i.item_id)).filter(Boolean) as AudioClip[];
  }, [items.length, clips.length]);
  const { clipAnalyses, analyzingClips, viewingAnalysis, setViewingAnalysis, handleAnalyze } = useClipAnalysis(favClips);

  useEffect(() => {
    if (!loaded) loadFavorites();
  }, [loaded, loadFavorites]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = { audio: [], clip: [], word: [] };
    for (const item of items) {
      if (g[item.item_type]) g[item.item_type].push(item);
    }
    return g;
  }, [items]);

  const tabs = (['all', 'audio', 'clip', 'word'] as const);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('all');

  const typeCounts: Record<string, number> = {};
  for (const item of items) typeCounts[item.item_type] = (typeCounts[item.item_type] || 0) + 1;
  const activeItems = activeTab === 'all' ? items : (grouped[activeTab] || []);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(activeItems.map(i => i.id)));
  const deselectAll = () => setSelected(new Set());

  const batchUnfavorite = async () => {
    for (const id of selected) {
      await removeFavorite(id);
    }
    setSelected(new Set());
    setSelectMode(false);
    loadFavorites();
  };

  const handlePlay = async (item: typeof items[number]) => {
    try {
      if (item.item_type === 'audio') {
        const lesson = await getLessonById(item.item_id);
        playLesson(lesson);
      } else if (item.item_type === 'clip') {
        const data = JSON.parse(item.extra_data || '{}');
        const lessonId = data.lessonId || item.item_id;
        const lesson = await getLessonById(lessonId);
        playClip({ id: item.item_id, lessonId, lessonTitle: lesson.title, startWordId: '', endWordId: '', startTime: data.start || 0, endTime: data.end || 0, text: item.subtitle || '', note: '', color: '#facc15', createdAt: '' }, lesson);
      }
    } catch (e) { console.error('播放收藏失败', e); }
  };

  // Group clip favorites by audio for play-all
  const clipFavoritesByAudio = useMemo(() => {
    const g = new Map<string, typeof items>();
    for (const item of items) {
      if (item.item_type !== 'clip') continue;
      const key = item.subtitle || '未知';
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(item);
    }
    return g;
  }, [items]);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold text-primary tracking-tight flex items-center gap-2">
            <HiHeart size={22} className="text-[var(--accent)]" />
            收藏
            <span className="text-sm font-normal text-tertiary ml-1">{items.length}</span>
          </h1>
          <div className="flex items-center gap-2">
            {selectMode && (
              <span className="text-xs text-secondary">{selected.size} 已选</span>
            )}
            <button onClick={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                selectMode ? 'bg-[var(--accent)] on-accent' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-tertiary)]'
              }`}>
              {selectMode ? '完成' : '选择'}
            </button>
          </div>
        </div>
      </div>

      {/* Batch action bar */}
      {selectMode && selected.size > 0 && (
        <div className="flex-shrink-0 px-8 pb-3 flex items-center gap-3 animate-fade-in">
          <button onClick={selectAll} className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer">全选</button>
          <button onClick={deselectAll} className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer">取消</button>
          <div className="flex-1" />
          <button onClick={batchUnfavorite}
            className="flex items-center gap-1.5 text-xs text-[var(--accent)] hover:opacity-80 transition-opacity cursor-pointer">
            <HiTrash size={12} /> 取消收藏 ({selected.size})
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex-shrink-0 px-8 pb-4 flex items-center gap-1 border-b border-[var(--border-secondary)]">
        {tabs.map(tab => {
          const meta = tab === 'all' ? null : TYPE_META[tab];
          const count = tab === 'all' ? items.length : (typeCounts[tab] || 0);
          return (
            <button key={tab} onClick={() => { setActiveTab(tab); setSelected(new Set()); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === tab ? 'bg-[var(--bg-active)] text-primary' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-tertiary)]'
              }`}>
              {meta && <meta.icon size={13} />}
              {tab === 'all' ? '全部' : meta?.label}
              {count > 0 && <span className="text-xs text-tertiary">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {!loaded ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
          </div>
        ) : activeItems.length === 0 ? (
          <div className="text-center py-16">
            <HiHeart size={40} className="text-tertiary mx-auto mb-4" />
            <p className="text-tertiary text-sm">{activeTab === 'all' ? '还没有收藏' : `还没有收藏${TYPE_META[activeTab]?.label}`}</p>
            <p className="text-tertiary text-xs mt-1">在音频、片段或单词上点击 ♥ 收藏</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Show grouped clips with play-all when viewing clips tab */}
            {activeTab === 'clip' && clipFavoritesByAudio.size > 0 && (
              <div className="space-y-6">
                {[...clipFavoritesByAudio.entries()].map(([audioTitle, clipItems]) => (
                  <div key={audioTitle}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-tertiary uppercase tracking-wider">{audioTitle} · {clipItems.length} 个片段</p>
                      <button onClick={() => {
                        const qItems = clipItems.flatMap(item => {
                          const clip = clips.find(c => c.id === item.item_id);
                          return clip ? [{ kind: 'clip' as const, clip }] : [];
                        });
                        if (qItems.length === 0) { addToast('没有可播放的片段', 'info'); return; }
                        const ps = usePlaylistStore.getState();
                        ps.clearQueue();
                        ps.addAllToQueue(qItems);
                        ps.setCurrentIndex(0);
                        playClip(qItems[0].clip);
                        addToast(`即将播放 ${qItems.length} 个片段`, 'success');
                      }}
                        className="flex items-center gap-1 text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer">
                        <HiPlay size={11} /> 播放全部
                      </button>
                    </div>
                    <div className="space-y-1">
                      {clipItems.map(item => {
                        const clip = clips.find(c => c.id === item.item_id);
                        const clipColor = clip?.color;
                        return (
                          <div key={item.id}
                            className="group rounded-xl p-3 transition-all duration-200 cursor-pointer hover:bg-[var(--bg-tertiary)]"
                            onClick={() => handlePlay(item)}>
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ background: clipColor ? clipColor + '30' : 'var(--clip-gradient)' }}>
                                <HiBookmark size={16} style={{ color: clipColor || undefined }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] text-secondary leading-relaxed line-clamp-2">"{item.title}"</p>
                                <div className="flex items-center gap-2 mt-1">
                                  {item.created_at && <span className="text-xs text-tertiary">{fmtDate(item.created_at)}</span>}
                                </div>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                {clip && (
                                  <ClipActions
                                    clip={clip}
                                    size="sm"
                                    analysis={clipAnalyses.get(clip.text) ?? null}
                                    isAnalyzing={analyzingClips.has(clip.text)}
                                    onAnalyze={handleAnalyze}
                                    onViewAnalysis={setViewingAnalysis}
                                    onEdit={(id, data) => updateClip(id, data)}
                                    onDelete={id => removeClip(id)}
                                    onAddToQueue={c => { addToQueue({ kind: 'clip', clip: c }); addToast('已加入队列', 'success'); }}
                                  />
                                )}
                                <button onClick={e => { e.stopPropagation(); toggle({ item_id: item.item_id, item_type: item.item_type, title: item.title }); }}
                                  className="p-1.5 text-[var(--accent)] transition-colors cursor-pointer">
                                  <HiHeart size={13} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Default list view for non-clip tabs */}
            {activeTab !== 'clip' && activeItems.map(item => {
              const meta = TYPE_META[item.item_type] || TYPE_META.audio;
              const Icon = meta.icon;
              const fav = isFav(item.item_id, item.item_type);
              const isSelected = selected.has(item.id);
              return (
                <div key={item.id}
                  className={`group rounded-xl p-4 transition-all duration-200 cursor-pointer ${
                    isSelected ? 'ring-2 ring-[var(--accent)]/40' : 'hover:bg-[var(--bg-tertiary)]'
                  }`}
                  style={{ background: isSelected ? 'var(--accent-soft)' : 'var(--bg-tertiary)' }}
                  onClick={() => { if (!selectMode && item.item_type !== 'word') handlePlay(item); }}>
                  <div className="flex items-start gap-3">
                    {selectMode && (
                      <div onClick={e => { e.stopPropagation(); toggleSelect(item.id); }}
                        className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-1 cursor-pointer transition-colors ${
                          isSelected ? 'bg-[var(--accent)]' : 'border border-[var(--border-primary)]'
                        }`}>
                        {isSelected && <HiCheckCircle size={14} className="on-accent" />}
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: meta.gradient }}>
                      <Icon size={16} className="text-tertiary group-hover:text-secondary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.item_type === 'clip' ? (
                        <>
                          <p className="text-[14px] text-secondary leading-relaxed line-clamp-2">"{item.title}"</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs text-tertiary">{item.subtitle} · {fmtDate(item.created_at)}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-primary">{item.title}</p>
                          <p className="text-xs text-tertiary mt-0.5">{item.subtitle}</p>
                          {item.item_type === 'audio' && <p className="text-xs text-tertiary mt-0.5">{fmtDate(item.created_at)}</p>}
                        </>
                      )}
                    </div>
                    {!selectMode && (
                      <>
                        {item.item_type !== 'word' && (
                          <button onClick={e => { e.stopPropagation(); handlePlay(item); }}
                            className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-active)] text-tertiary hover:text-secondary transition-all cursor-pointer">
                            <HiPlay size={12} />
                          </button>
                        )}
                        <button onClick={e => { e.stopPropagation(); toggle({ item_id: item.item_id, item_type: item.item_type, title: item.title }); }}
                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${fav ? 'text-[var(--accent)]' : 'text-tertiary hover:text-tertiary'}`}>
                          <HiHeart size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewingAnalysis && (
        <ClipAnalysisModal analysis={viewingAnalysis} onClose={() => setViewingAnalysis(null)} />
      )}
    </div>
  );
}
