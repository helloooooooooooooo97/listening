import { useEffect, useMemo, useState } from 'react';
import { HiHeart, HiPlay, HiMusicalNote, HiBookmark, HiTag } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { getLessonById } from '../lib/api';

const TYPE_META = {
  audio: { icon: HiMusicalNote, gradient: 'linear-gradient(135deg,#2a1020,#1a0a10)', label: '音频', empty: '还没有收藏音频' },
  clip: { icon: HiBookmark, gradient: 'linear-gradient(135deg,#0a2a1a,#051a10)', label: '片段', empty: '还没有收藏片段' },
  word: { icon: HiTag, gradient: 'linear-gradient(135deg,#1a1a2e,#0d0d1a)', label: '单词', empty: '还没有收藏单词' },
} as const;

export default function FavoritesView() {
  const items = useFavoritesStore(s => s.items);
  const loadFavorites = useFavoritesStore(s => s.loadFavorites);
  const loaded = useFavoritesStore(s => s.loaded);
  const toggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);

  useEffect(() => {
    if (!loaded) loadFavorites();
  }, [loaded, loadFavorites]);

  // Group by type
  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = { audio: [], clip: [], word: [] };
    for (const item of items) {
      if (g[item.item_type]) g[item.item_type].push(item);
    }
    return g;
  }, [items]);

  const handlePlay = async (item: typeof items[number]) => {
    try {
      if (item.item_type === 'audio') {
        const lesson = await getLessonById(item.item_id);
        playLesson(lesson);
      } else if (item.item_type === 'clip') {
        const data = JSON.parse(item.extra_data || '{}');
        const lessonId = data.lessonId || item.item_id;
        const lesson = await getLessonById(lessonId);
        playClip({
          id: item.item_id, lessonId,
          lessonTitle: lesson.title,
          startWordId: '', endWordId: '',
          startTime: data.start || 0, endTime: data.end || 0,
          text: item.subtitle || '', note: '', createdAt: '',
        }, lesson);
      }
    } catch (e) {
      console.error('播放收藏失败', e);
    }
  };

  const tabs = (['all', 'audio', 'clip', 'word'] as const);
  const [activeTab, setActiveTab] = useState<typeof tabs[number]>('all');

  const typeCounts: Record<string, number> = {};
  for (const item of items) {
    typeCounts[item.item_type] = (typeCounts[item.item_type] || 0) + 1;
  }

  const activeItems = activeTab === 'all' ? items : (grouped[activeTab] || []);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <HiHeart size={22} className="text-[#fa2d48]" />
          收藏
          <span className="text-sm font-normal text-white/20 ml-1">{items.length}</span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 px-8 pb-4 flex items-center gap-1 border-b border-white/[0.04]">
        {tabs.map(tab => {
          const meta = tab === 'all' ? null : TYPE_META[tab];
          const count = tab === 'all' ? items.length : (typeCounts[tab] || 0);
          return (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                activeTab === tab
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/[0.04]'
              }`}>
              {meta && <meta.icon size={13} />}
              {tab === 'all' ? '全部' : meta?.label}
              {count > 0 && <span className="text-[10px] text-white/20">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        {!loaded ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
          </div>
        ) : activeItems.length === 0 ? (
          <div className="text-center py-16">
            <HiHeart size={40} className="text-white/10 mx-auto mb-4" />
            <p className="text-white/20 text-sm">
              {activeTab === 'all' ? '还没有收藏' : `还没有收藏${TYPE_META[activeTab]?.label}`}
            </p>
            <p className="text-white/10 text-xs mt-1">在音频、片段或单词上点击 ♥ 收藏</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeItems.map(item => {
              const meta = TYPE_META[item.item_type] || TYPE_META.audio;
              const Icon = meta.icon;
              const fav = isFav(item.item_id, item.item_type);
              return (
                <div key={item.id}
                  className="group rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.04] cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                  onClick={() => item.item_type !== 'word' && handlePlay(item)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: meta.gradient }}>
                      <Icon size={16} className="text-white/30 group-hover:text-white/60 transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {item.item_type === 'clip' ? (
                        <>
                          <p className="text-[13px] text-white/70 leading-relaxed line-clamp-2">"{item.title}"</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-white/30">{item.subtitle} · {item.created_at?.slice(0, 10)}</span>
                          </div>
                        </>
                      ) : item.item_type === 'word' ? (
                        <>
                          <p className="text-sm font-medium text-white/80">{item.title}</p>
                          <p className="text-[11px] text-white/30 mt-0.5">{item.subtitle || '单词'}</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-white/80">{item.title}</p>
                          <p className="text-[11px] text-white/30 mt-0.5">{item.subtitle}</p>
                          <p className="text-[10px] text-white/15 mt-0.5">{item.created_at?.slice(0, 10)}</p>
                        </>
                      )}
                    </div>
                    {item.item_type !== 'word' && (
                      <button onClick={e => { e.stopPropagation(); handlePlay(item); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] text-white/30 hover:text-white/60 transition-all cursor-pointer">
                        <HiPlay size={12} />
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); toggle({ item_id: item.item_id, item_type: item.item_type, title: item.title }); }}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${fav ? 'text-[#fa2d48]' : 'text-white/10 hover:text-white/30'}`}>
                      <HiHeart size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
