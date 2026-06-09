import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiQueueList, HiHeart, HiClock, HiPencil, HiTag, HiMusicalNote, HiPlus, HiTrash, HiArrowPath, HiPlay, HiFolderOpen, HiBookmark, HiBookOpen, HiPencilSquare, HiChartBar, HiCircleStack, HiInformationCircle, HiAcademicCap } from 'react-icons/hi2';
import { useCollectionsStore } from '../stores/collectionsStore';
import { usePlaylistStore } from '../stores/playlistStore';
import { useAudioStore } from '../stores/audioStore';
import { useToastStore } from '../stores/toastStore';
import { getCollection } from '../lib/api';
import { collectionItemsToQueueItems } from '../lib/collectionQueue';
import type { CollectionSummary } from '../types/lesson';

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>> = {
  HiHeart: HiHeart, HiClock: HiClock, HiPencil: HiPencil,
  HiTag: HiTag, HiMusicalNote: HiMusicalNote, HiQueueList: HiQueueList,
  HiFolderOpen: HiFolderOpen, HiBookmark: HiBookmark,
  HiBookOpen: HiBookOpen, HiPencilSquare: HiPencilSquare,
};

const DEFAULT_COLOR = '#3b82f6';
const ITEM_COLORS = ['#fa2d48', '#f59e0b', '#8b5cf6', '#3b82f6', '#10b981'];
const DEFAULT_ICON = 'HiQueueList';

function formatNum(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

type SectionDef = {
  id: string;
  title: string;
  icon: React.ReactNode;
  desc: string;
  filter: (c: CollectionSummary) => boolean;
};

const SECTIONS: SectionDef[] = [
  {
    id: 'data',
    title: '学习数据',
    icon: <HiChartBar size={14} />,
    desc: '根据你的学习行为自动生成',
    filter: c => c.is_dynamic && ['favorites', 'today_practice', 'recent_plays', 'recent_dictation_errors', 'frequent_wrong_words'].includes(c.dynamic_type || ''),
  },
  {
    id: 'all',
    title: '全部内容',
    icon: <HiCircleStack size={14} />,
    desc: '所有学习资料的汇总',
    filter: c => c.is_dynamic && ['all_audio', 'all_clips', 'all_words', 'all_dictation'].includes(c.dynamic_type || ''),
  },
  {
    id: 'category',
    title: '课程分类',
    icon: <HiAcademicCap size={14} />,
    desc: '按课程类型自动归类',
    filter: c => c.is_dynamic && (c.dynamic_type || '').startsWith('category:'),
  },
];

// ════════════════════════════════════════
//  Album-style config per type
// ════════════════════════════════════════

interface AlbumStyle {
  gradient: string; pattern: string; iconSize: number; badgeLabel: string; decor?: string;
}
function getAlbumStyle(col: CollectionSummary): AlbumStyle {
  const dt = col.dynamic_type || '';
  const m: Record<string, AlbumStyle> = {
    favorites: { gradient: 'linear-gradient(135deg, #fa2d48, #ff6b7f, #ff8a9e)', pattern: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.15) 0, transparent 30px), radial-gradient(circle at 70% 60%, rgba(255,255,255,0.1) 0, transparent 25px)', iconSize: 40, badgeLabel: '收藏', decor: 'heart' },
    today_practice: { gradient: 'linear-gradient(135deg, #f59e0b, #fbbf24, #fcd34d)', pattern: 'repeating-linear-gradient(0deg, transparent 0, transparent 8px, rgba(255,255,255,0.08) 8px, rgba(255,255,255,0.08) 9px), repeating-linear-gradient(90deg, transparent 0, transparent 8px, rgba(255,255,255,0.08) 8px, rgba(255,255,255,0.08) 9px)', iconSize: 38, badgeLabel: '今日', decor: 'grid' },
    recent_dictation_errors: { gradient: 'linear-gradient(135deg, #6d28d9, #8b5cf6, #a78bfa)', pattern: 'repeating-linear-gradient(-45deg, transparent 0, transparent 6px, rgba(255,255,255,0.06) 6px, rgba(255,255,255,0.06) 7px)', iconSize: 36, badgeLabel: '错句', decor: 'crosshatch' },
    recent_plays: { gradient: 'linear-gradient(135deg, #1d4ed8, #3b82f6, #60a5fa)', pattern: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.12) 0, transparent 40px), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.08) 0, transparent 35px)', iconSize: 38, badgeLabel: '最近', decor: 'circles' },
    frequent_wrong_words: { gradient: 'linear-gradient(135deg, #047857, #10b981, #34d399)', pattern: 'repeating-radial-gradient(circle at 50% 50%, transparent 0, transparent 15px, rgba(255,255,255,0.05) 15px, rgba(255,255,255,0.05) 16px)', iconSize: 36, badgeLabel: '高频', decor: 'dots' },
    all_audio: { gradient: 'linear-gradient(135deg, #991b1b, #ef4444, #f87171)', pattern: 'repeating-linear-gradient(90deg, transparent 0, transparent 10px, rgba(255,255,255,0.06) 10px, rgba(255,255,255,0.06) 12px), repeating-linear-gradient(0deg, transparent 0, transparent 10px, rgba(255,255,255,0.04) 10px, rgba(255,255,255,0.04) 11px)', iconSize: 42, badgeLabel: '全部', decor: 'waveform' },
    all_clips: { gradient: 'linear-gradient(135deg, #c2410c, #f97316, #fb923c)', pattern: 'repeating-linear-gradient(45deg, transparent 0, transparent 12px, rgba(255,255,255,0.07) 12px, rgba(255,255,255,0.07) 13px), repeating-linear-gradient(-45deg, transparent 0, transparent 12px, rgba(255,255,255,0.04) 12px, rgba(255,255,255,0.04) 13px)', iconSize: 36, badgeLabel: '片段', decor: 'stripes' },
    all_words: { gradient: 'linear-gradient(135deg, #7e22ce, #a855f7, #c084fc)', pattern: 'repeating-linear-gradient(0deg, transparent 0, transparent 20px, rgba(255,255,255,0.04) 20px, rgba(255,255,255,0.04) 21px)', iconSize: 38, badgeLabel: '单词', decor: 'lines' },
    all_dictation: { gradient: 'linear-gradient(135deg, #0e7490, #06b6d4, #22d3ee)', pattern: 'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.08) 0, transparent 20px), radial-gradient(circle at 30% 70%, rgba(255,255,255,0.06) 0, transparent 15px)', iconSize: 36, badgeLabel: '听写', decor: 'bubbles' },
  };
  if (dt === 'category:IELTS') return { gradient: 'linear-gradient(135deg, #1e3a5f, #2563eb, #3b82f6)', pattern: 'repeating-linear-gradient(90deg, transparent 0, transparent 8px, rgba(255,255,255,0.05) 8px, rgba(255,255,255,0.05) 10px)', iconSize: 38, badgeLabel: 'IELTS', decor: 'lines' };
  if (dt === "category:Aesop's Fables") return { gradient: 'linear-gradient(135deg, #78350f, #d97706, #f59e0b)', pattern: 'radial-gradient(circle at 25% 35%, rgba(255,255,255,0.1) 0, transparent 20px), radial-gradient(circle at 75% 65%, rgba(255,255,255,0.06) 0, transparent 15px)', iconSize: 38, badgeLabel: '寓言', decor: 'circles' };
  return m[dt] || { gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)', pattern: '', iconSize: 36, badgeLabel: '' };
}

function DecorHeart() { return (<svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100" fill="none"><path d="M50 85C50 85 15 60 15 38C15 28 23 20 33 20C40 20 46 25 50 30C54 25 60 20 67 20C77 20 85 28 85 38C85 60 50 85 50 85Z" fill="white" /><path d="M50 75C50 75 25 55 25 40C25 33 31 27 38 27C43 27 48 31 50 35C52 31 57 27 62 27C69 27 75 33 75 40C75 55 50 75 50 75Z" fill="white" opacity="0.5" /></svg>); }
function DecorWaveform() { return (<svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 100 100" fill="none">{[5,15,25,35,45,55,65,75,85,95].map((x,i)=><rect key={i} x={x-2} y={30+Math.sin(i*1.2)*20} width={4} height={40-Math.sin(i*1.2)*20} rx={2} fill="white" opacity={0.3+((i*7)%5)*0.08}/>)}</svg>); }
function DecorGrid() { return (<svg className="absolute inset-0 w-full h-full opacity-12" viewBox="0 0 100 100" fill="none">{[[0,25,50,75,100].map(y=><line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="white" strokeWidth="0.5"/>),[0,25,50,75,100].map(x=><line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" stroke="white" strokeWidth="0.5"/>),<circle cx="50" cy="50" r="18" stroke="white" strokeWidth="1" fill="none" opacity="0.3"/>]}</svg>); }
function DecorDots() { return (<svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 100 100">{Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=><circle key={`${r}-${c}`} cx={10+c*20} cy={10+r*20} r={1.5+((r+c)%3)*0.8} fill="white" opacity={0.2+((r+c)%4)*0.15}/>))}</svg>); }
function DecorStripes() { return (<svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">{[5,15,25,35,45,55,65,75,85,95].map(x=><rect key={x} x={x-1} y="0" width={2} height={100} fill="white" opacity={0.25} rx={1}/>)}</svg>); }
function DecorCrosshatch() { return (<svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">{[0,10,20,30,40,50,60,70,80,90,100].map(i=><line key={`f${i}`} x1={i} y1="0" x2={i-20} y2="100" stroke="white" strokeWidth="0.5"/>)} {[0,10,20,30,40,50,60,70,80,90,100].map(i=><line key={`b${i}`} x1={i} y1="0" x2={i+20} y2="100" stroke="white" strokeWidth="0.5"/>)}</svg>); }
function DecorBubbles() { return (<svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 100 100"><circle cx="20" cy="25" r="12" stroke="white" strokeWidth="0.5" fill="none" opacity="0.3"/><circle cx="75" cy="30" r="8" stroke="white" strokeWidth="0.5" fill="none" opacity="0.25"/><circle cx="30" cy="70" r="10" stroke="white" strokeWidth="0.5" fill="none" opacity="0.2"/><circle cx="80" cy="75" r="14" stroke="white" strokeWidth="0.5" fill="none" opacity="0.3"/><circle cx="55" cy="50" r="6" stroke="white" strokeWidth="0.5" fill="none" opacity="0.2"/><circle cx="15" cy="15" r="4" stroke="white" strokeWidth="0.5" fill="none" opacity="0.15"/><circle cx="85" cy="15" r="5" stroke="white" strokeWidth="0.5" fill="none" opacity="0.15"/></svg>); }
function DecorLines() { return (<svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 100 100">{[10,20,30,40,50,60,70,80,90].map(y=><line key={y} x1="5" y1={y} x2="95" y2={y} stroke="white" strokeWidth="0.5" opacity={y%20===0?0.35:0.15}/>)}</svg>); }

function getDecor(decor?: string) {
  switch (decor) {
    case 'heart': return <DecorHeart />;
    case 'waveform': return <DecorWaveform />;
    case 'grid': return <DecorGrid />;
    case 'dots': return <DecorDots />;
    case 'stripes': return <DecorStripes />;
    case 'circles': return <DecorBubbles />;
    case 'bubbles': return <DecorBubbles />;
    case 'crosshatch': return <DecorCrosshatch />;
    case 'lines': return <DecorLines />;
    default: return null;
  }
}


export default function CollectionsView() {
  const navigate = useNavigate();
  const collections = useCollectionsStore(s => s.collections);
  const loaded = useCollectionsStore(s => s.loaded);
  const loading = useCollectionsStore(s => s.loading);
  const loadCollections = useCollectionsStore(s => s.loadCollections);
  const remove = useCollectionsStore(s => s.remove);
  const addToast = useToastStore(s => s.addToast);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);

  useEffect(() => {
    if (!loaded) loadCollections();
  }, [loaded, loadCollections]);

  const userCols = collections.filter(c => !c.is_dynamic);
  const totalItems = collections.reduce((s, c) => s + (c.item_count || 0), 0);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    const col = useCollectionsStore.getState();
    const iconIdx = collections.filter(c => !c.is_dynamic).length % ITEM_COLORS.length;
    const r = await col.create(newName.trim(), DEFAULT_ICON, ITEM_COLORS[iconIdx]);
    if (r) { setNewName(''); setShowCreate(false); }
    setCreating(false);
  };

  const handleDelete = async (id: number) => {
    setDeleting(id);
    await remove(id);
    setDeleting(null);
  };

  // ── Play collection: fetch items, queue them, play first ──
  const playCollection = async (col: CollectionSummary) => {
    if (playingId !== null) return;
    setPlayingId(col.id);
    try {
      const detail = await getCollection(col.id);
      const items = detail.items || [];
      if (items.length === 0) { addToast('合集为空', 'info'); return; }

      const queueItems = await collectionItemsToQueueItems(items);

      if (queueItems.length === 0) { addToast('没有可播放的条目', 'info'); return; }

      const ps = usePlaylistStore.getState();
      ps.clearQueue();
      ps.addAllToQueue(queueItems);
      ps.setCurrentIndex(0);

      useAudioStore.getState().playQueueItem(queueItems[0]);

      addToast(`即将播放 ${queueItems.length} 项`, 'success');
    } catch {
      addToast('加载失败', 'error');
    } finally {
      setPlayingId(null);
    }
  };

  if (loading && !loaded) {
    return (
      <div className="h-full flex flex-col bg-[var(--bg-primary)]">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/10 border-t-[var(--accent)] rounded-full" />
        </div>
      </div>
    );
  }

  const dynamicBySection = SECTIONS.map(s => ({ ...s, items: collections.filter(s.filter) })).filter(s => s.items.length > 0);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-6 border-b border-[var(--border-secondary)]">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary tracking-tight">合集</h1>
            <p className="text-sm text-tertiary mt-1">{collections.length} 个合集 · 共 {totalItems} 个条目</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--accent)] on-accent transition-all hover:opacity-90 cursor-pointer shadow-lg shadow-[var(--accent)]/20">
            <HiPlus size={14} /> 新建
          </button>
        </div>
        {showCreate && (
          <div className="mt-4 p-4 rounded-xl border border-[var(--border-secondary)] animate-fade-in" style={{ background: 'var(--bg-tertiary)' }}
            onKeyDown={e => { if (e.key === 'Escape') setShowCreate(false); }}>
            <p className="text-xs font-medium text-secondary mb-2">合集名称</p>
            <div className="flex items-center gap-2">
              <input type="text" value={newName} autoFocus
                onChange={e => setNewName(e.target.value)}
                placeholder="例如：雅思听力重点、每日精听..."
                className="flex-1 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-primary outline-none focus:ring-2 focus:ring-[var(--accent)]/30 placeholder:text-tertiary"
                onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
              />
              <button onClick={handleCreate} disabled={creating || !newName.trim()}
                className="text-sm px-5 py-2.5 rounded-xl bg-[var(--accent)] on-accent cursor-pointer disabled:opacity-50 font-medium whitespace-nowrap">创建</button>
              <button onClick={() => setShowCreate(false)}
                className="text-sm px-4 py-2.5 rounded-xl text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">取消</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {collections.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-5 shadow-xl"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #a78bfa)' }}>
              <HiQueueList size={40} className="text-white/80" />
            </div>
            <h2 className="text-lg font-bold text-primary mb-2">还没有合集</h2>
            <p className="text-tertiary text-sm max-w-xs">创建自定义合集来组织你的学习内容</p>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-8 pt-6">
            {dynamicBySection.map(section => (
              <section key={section.id}>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)] text-secondary">{section.icon}</div>
                  <div>
                    <h2 className="text-sm font-bold text-primary">{section.title}</h2>
                    <p className="text-[11px] text-tertiary">{section.desc} · {section.items.length} 个合集</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {section.items.map(col => (
                    <AlbumCard
                      key={col.id}
                      collection={col}
                      onPlay={() => playCollection(col)}
                      onDetail={() => navigate(`/collections/${col.id}`)}
                      onRefresh={() => useCollectionsStore.getState().refresh(col.id)}
                      playing={playingId === col.id}
                    />
                  ))}
                </div>
              </section>
            ))}
            {userCols.length > 0 && (
              <section>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[var(--bg-tertiary)] text-secondary"><HiFolderOpen size={14} /></div>
                  <div>
                    <h2 className="text-sm font-bold text-primary">我的合集</h2>
                    <p className="text-[11px] text-tertiary">自定义创建 · {userCols.length} 个</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                  {userCols.map(col => (
                    <UserAlbumCard
                      key={col.id}
                      collection={col}
                      onPlay={() => playCollection(col)}
                      onDetail={() => navigate(`/collections/${col.id}`)}
                      onDelete={() => handleDelete(col.id)}
                      deleting={deleting === col.id}
                      playing={playingId === col.id}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ Album Card ═══

function AlbumCard({ collection, onPlay, onDetail, onRefresh, playing }: { collection: CollectionSummary; onPlay: () => void; onDetail: () => void; onRefresh: () => void; playing: boolean }) {
  const Icon = ICON_MAP[collection.icon] || HiQueueList;
  const style = getAlbumStyle(collection);
  const decor = getDecor(style.decor);

  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onRefresh();
  };

  return (
    <div className="group cursor-pointer" onClick={onPlay}>
      <div className={`relative aspect-square rounded-2xl overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:scale-[1.03] group-active:scale-[0.98] ${playing ? 'animate-pulse' : ''}`}
        style={{ background: style.gradient }}>
        <div className="absolute inset-0" style={{ backgroundImage: style.pattern }} />
        {decor}
        <div className="absolute inset-0 flex items-center justify-center">
          {playing ? (
            <div className="flex items-center gap-1">
              <span className="w-2 h-6 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-8 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-5 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <Icon size={style.iconSize} className="text-white/90 drop-shadow-lg" />
          )}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <HiPlay size={20} className="text-black ml-0.5" />
          </div>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onDetail(); }}
            className="w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100"
            title="查看详情">
            <HiInformationCircle size={13} />
          </button>
          <button onClick={handleRefresh}
            className={`w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100`}
            title="刷新">
            <HiArrowPath size={12} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/50 to-transparent">
          <span className="text-white text-[11px] font-semibold drop-shadow tracking-wide">{style.badgeLabel.toUpperCase()} · {formatNum(collection.item_count)}</span>
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="text-sm font-semibold text-primary truncate leading-tight">{collection.name}</p>
      </div>
    </div>
  );
}

// ═══ User Album Card ═══

function UserAlbumCard({ collection, onPlay, onDetail, onDelete, deleting, playing }: { collection: CollectionSummary; onPlay: () => void; onDetail: () => void; onDelete: () => void; deleting: boolean; playing: boolean }) {
  const Icon = ICON_MAP[collection.icon] || HiFolderOpen;
  const color = collection.color || DEFAULT_COLOR;
  const gradient = `linear-gradient(135deg, ${color}, ${color}cc)`;
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 3000); }
    else { onDelete(); setConfirmDelete(false); }
  };

  return (
    <div className="group cursor-pointer" onClick={onPlay}>
      <div className={`relative aspect-square rounded-2xl overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-xl group-hover:scale-[1.03] group-active:scale-[0.98] ${playing ? 'animate-pulse' : ''}`}
        style={{ background: gradient }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 15px, rgba(255,255,255,0.06) 15px, rgba(255,255,255,0.06) 16px)` }} />
        <div className="absolute inset-0 flex items-center justify-center">
          {playing ? (
            <div className="flex items-center gap-1">
              <span className="w-2 h-6 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-8 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-5 bg-white/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <Icon size={40} className="text-white/80 drop-shadow-lg" />
          )}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 shadow-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
            <HiPlay size={20} className="text-black ml-0.5" />
          </div>
        </div>
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onDetail(); }}
            className="w-7 h-7 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white transition-all cursor-pointer opacity-0 group-hover:opacity-100"
            title="查看详情">
            <HiInformationCircle size={13} />
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className={`w-7 h-7 rounded-full backdrop-blur-sm flex items-center justify-center transition-all cursor-pointer ${
              confirmDelete ? 'bg-[var(--accent)] text-white' : 'bg-black/20 text-white/70 hover:text-white opacity-0 group-hover:opacity-100'
            }`}
            title={confirmDelete ? '确认删除' : '删除'}>
            <HiTrash size={12} />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-3 py-2 bg-gradient-to-t from-black/50 to-transparent">
          <span className="text-white text-[11px] font-semibold drop-shadow">{formatNum(collection.item_count)} 项</span>
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <p className="text-sm font-semibold text-primary truncate leading-tight">{collection.name}</p>
      </div>
    </div>
  );
}
