import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiMusicalNote, HiBookmark, HiBookOpen, HiMagnifyingGlass, HiClock, HiFolderOpen, HiHeart, HiTag, HiSun, HiArrowPath, HiSparkles } from 'react-icons/hi2';
import HeartButton from '../components/HeartButton';
import ReviewModal from '../components/words/ReviewModal';
import type { AudioClip, LessonSummary } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useCollectionsStore } from '../stores/collectionsStore';
import { getLessonById, getOverview, getDueWordsCount, getTodayStats, getTodayWords, getDueWords } from '../lib/api';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  lessons: LessonSummary[];
  clips: AudioClip[];
  uniqueWords: number;
}

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}); }

const COLLECTION_COLORS: Record<string, string> = {
  favorites: '#fa2d48',
  today_practice: '#f59e0b',
  recent_dictation_errors: '#8b5cf6',
  recent_plays: '#3b82f6',
  frequent_wrong_words: '#10b981',
};

const COLLECTION_ICONS: Record<string, React.ComponentType<{size?: number; style?: React.CSSProperties}>> = {
  favorites: HiHeart,
  today_practice: HiClock,
  recent_dictation_errors: HiClock,
  recent_plays: HiClock,
  frequent_wrong_words: HiTag,
};

export default function HomeView({ search, onSearchChange, lessons, clips, uniqueWords }: Props) {
  const navigate = useNavigate();
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const dailyGoal = useSettingsStore(s => s.settings.dailyGoalMinutes);
  const collections = useCollectionsStore(s => s.collections);
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [dueWordsCount, setDueWordsCount] = useState(0);
  const [todayWordsStats, setTodayWordsStats] = useState<{ total_words: number; reviewed_count: number; audio_count: number } | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewWords, setReviewWords] = useState<{ word: string; source?: string }[]>([]);

  const openTodayReview = () => {
    getTodayWords().then(d => {
      if (d.words.length > 0) {
        setReviewWords(d.words.filter(w => !w.known).map(w => ({ word: w.word, source: '今日单词' })));
        setReviewOpen(true);
      }
    }).catch(() => {});
  };

  const openDueReview = () => {
    getDueWords(200).then(({ words }) => {
      if (words.length > 0) {
        setReviewWords(words.map(d => ({ word: d.word, source: '待复习' })));
        setReviewOpen(true);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    getDueWordsCount().then(d => setDueWordsCount(d.count)).catch(() => {});
    getTodayStats().then(s => setTodayWordsStats(s)).catch(() => {});
  }, []);

  useEffect(() => {
    if (dailyGoal > 0) {
      getOverview().then(o => setTodaySeconds(o.today_seconds)).catch(() => {});
    }
  }, [dailyGoal]);
  const q = search.toLowerCase();
  const fL = lessons.filter(l => l.title.toLowerCase().includes(q) || l.subtitle.toLowerCase().includes(q));
  const fC = clips.filter(c => c.text.toLowerCase().includes(q) || c.note.toLowerCase().includes(q) || c.lessonTitle.toLowerCase().includes(q));
  const totalDuration = lessons.reduce((a,l)=>a+l.duration,0);
  const dynamicCols = collections.filter(c => c.is_dynamic && c.item_count > 0).slice(0, 4);

  return (
    <><div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-12 pb-8" style={{ background: 'var(--hero-gradient)' }}>
        <div className="flex items-end justify-between gap-8">
          <div>
            <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-2">欢迎回来</h1>
            <p className="text-tertiary text-sm">继续你的英语听力练习</p>
          </div>
          <div className="relative w-full md:w-80">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-tertiary"><HiMagnifyingGlass size={16} /></span>
            <input type="text" placeholder="搜索音频、片段..." value={search} onChange={e=>onSearchChange(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-[14px] bg-[var(--bg-hover)] border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 text-primary placeholder:text-tertiary" />
          </div>
        </div>
        {q && <p className="text-xs text-tertiary mt-3">找到 {fL.length} 个音频 · {fC.length} 个片段</p>}
        {!q && dailyGoal > 0 && (
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${Math.min(100, (todaySeconds / 60 / dailyGoal) * 100)}%`,
                background: (todaySeconds / 60) >= dailyGoal
                  ? 'linear-gradient(90deg, #10b981, #34d399)'
                  : 'linear-gradient(90deg, var(--accent), #ff6b7f)',
              }} />
            </div>
            <span className="text-xs text-tertiary whitespace-nowrap">
              {Math.floor(todaySeconds / 60)} / {dailyGoal} 分钟
              {(todaySeconds / 60) >= dailyGoal && <span className="text-emerald-500 ml-1">✓ 完成</span>}
            </span>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
        {!q && (
          <div className="grid grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
            {[
              { label: '音频', value: lessons.length, icon: HiBookOpen, color: '#fa2d48' },
              { label: '片段', value: clips.length, icon: HiBookmark, color: '#10b981' },
              { label: '句子', value: lessons.reduce((a,l)=>a+l.sentenceCount,0), icon: HiClock, color: '#f59e0b' },
              { label: '单词', value: uniqueWords, icon: HiMagnifyingGlass, color: '#8b5cf6' },
              { label: '总时长', value: `${Math.floor(totalDuration/60)}分`, icon: HiMusicalNote, color: '#3b82f6' },
            ].map(s=>(
              <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={{background:'var(--bg-tertiary)'}}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:`${s.color}20`}}>
                  <span style={{color:s.color}}><s.icon size={18} /></span>
                </div>
                <div><p className="text-2xl font-bold text-primary tracking-tight">{s.value}</p><p className="text-xs text-tertiary">{s.label}</p></div>
              </div>
            ))}
          </div>
        )}

        {/* Word cards row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {!q && todayWordsStats && todayWordsStats.total_words > 0 && (
            <div className="group rounded-xl p-4 transition-all duration-200"
              style={{ background: 'var(--bg-tertiary)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f59e0b20' }}>
                    <HiSun size={18} className="text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary">今日单词</h3>
                    <p className="text-xs text-tertiary mt-0.5">
                      来自 {todayWordsStats.audio_count} 个音频 · 已复习 {todayWordsStats.reviewed_count}/{todayWordsStats.total_words}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-base font-bold text-primary tabular-nums">{todayWordsStats.total_words}</span>
                  <span className="text-xs text-tertiary">个</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate('/words')}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  📖 查看
                </button>
                {todayWordsStats.total_words > todayWordsStats.reviewed_count && (
                  <button onClick={openTodayReview}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
  <HiSparkles size={11} /> 复习 · {todayWordsStats.total_words - todayWordsStats.reviewed_count}
                  </button>
                )}
              </div>
            </div>
          )}

          {!q && dueWordsCount > 0 && (
            <div className="group rounded-xl p-4 transition-all duration-200"
              style={{ background: 'var(--bg-tertiary)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#8b5cf620' }}>
                    <HiArrowPath size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary">待复习单词</h3>
                    <p className="text-xs text-tertiary mt-0.5">点击开始复习</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-base font-bold text-primary tabular-nums">{dueWordsCount}</span>
                  <span className="text-xs text-tertiary">个</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => navigate('/words')}
                  className="flex-1 py-1.5 rounded-lg text-xs font-medium text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  📖 查看
                </button>
                <button onClick={openDueReview}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
<HiSparkles size={11} /> 全部复习
                </button>
              </div>
            </div>
          )}

          {!q && (
            <div onClick={() => navigate('/game')}
              className="group cursor-pointer rounded-xl p-4 transition-all duration-200 hover:bg-[var(--bg-tertiary)] flex items-center justify-between"
              style={{ background: 'var(--bg-tertiary)' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#f59e0b20' }}>
<HiSparkles size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-primary">单词消除游戏</h3>
                  <p className="text-xs text-tertiary mt-0.5">在游戏中复习单词</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs font-medium text-amber-400">🎮 开始</span>
              </div>
            </div>
          )}
        </div>

        {/* Collections quick entry */}
        {!q && dynamicCols.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-primary tracking-tight flex items-center gap-2">
                <HiFolderOpen size={16} /> 学习合集
              </h2>
              <button onClick={() => navigate('/collections')}
                className="text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer">
                查看全部 →
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {dynamicCols.map(col => {
                const Icon = COLLECTION_ICONS[col.dynamic_type || ''] || HiFolderOpen;
                const color = COLLECTION_COLORS[col.dynamic_type || ''] || col.color;
                return (
                  <div key={col.id} onClick={() => navigate(`/collections/${col.id}`)}
                    className="group cursor-pointer rounded-xl p-4 transition-all duration-200 hover:bg-[var(--bg-tertiary)]"
                    style={{ background: 'var(--bg-tertiary)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}20` }}>
                        <Icon size={18} style={{ color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-primary">{col.name}</p>
                        <p className="text-xs text-tertiary mt-0.5">{col.item_count} 项</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-primary tracking-tight">音频</h2>
          </div>
          {fL.length===0 ? <p className="text-tertiary text-sm py-4">{q?'无匹配音频':'暂无音频'}</p> : (
            <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {fL.slice(0,8).map(l=> {
                const fav = isFav(l.id, 'audio');
                return (
                  <div key={l.id} onClick={()=>getLessonById(l.id).then(d=>playLesson(d))}
                    className="group cursor-pointer rounded-lg p-1.5 transition-all duration-200 hover:bg-[var(--bg-tertiary)]">
                    <div className="w-full aspect-square rounded-md flex items-center justify-center mb-1 relative" style={{background:'var(--card-gradient)'}}>
                      <span className="text-tertiary group-hover:text-secondary transition-colors"><HiMusicalNote size={18}/></span>
                      <div className={`absolute top-1.5 right-1.5 ${fav ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                        <HeartButton
                          active={fav}
                          onToggle={() => favToggle({item_id:l.id,item_type:'audio',title:l.title,subtitle:l.subtitle})}
                          size={14}
                        />
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-primary truncate">{l.title}</p>
                    <p className="text-xs text-tertiary truncate">{l.subtitle}</p>
                    <span className="inline-block mt-0.5 text-[8px] font-medium px-1 py-0.5 rounded bg-[var(--bg-tertiary)] text-tertiary">{l.level}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {!q && clips.length>0 && (
          <div>
            <h2 className="text-lg font-bold text-primary tracking-tight mb-3">最近片段</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clips.slice(0,4).map(c=>{
                const d=c.endTime-c.startTime;
                return (
                  <div key={c.id} onClick={()=>playClip(c)}
                    className="group cursor-pointer rounded-xl p-4 transition-all duration-200 hover:bg-[var(--bg-tertiary)]" style={{background:'var(--bg-tertiary)'}}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'var(--clip-gradient)'}}>
                        <span className="text-tertiary"><HiBookmark size={16}/></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-secondary leading-relaxed line-clamp-2">"{c.text}"</p>
                        <p className="text-xs text-tertiary mt-1">{c.lessonTitle} · {d.toFixed(1)}s · {fmtDate(c.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>

    <ReviewModal
      open={reviewOpen}
      onClose={() => setReviewOpen(false)}
      words={reviewWords}
      mode="fill-in"
    />
    </>
  );
}
