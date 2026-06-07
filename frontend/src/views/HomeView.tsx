import { useState, useEffect } from 'react';
import { HiMusicalNote, HiBookmark, HiBookOpen, HiMagnifyingGlass, HiClock, HiHeart } from 'react-icons/hi2';
import type { AudioClip, LessonSummary } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getLessonById, getOverview } from '../lib/api';

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  lessons: LessonSummary[];
  clips: AudioClip[];
  uniqueWords: number;
}

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}); }

export default function HomeView({ search, onSearchChange, lessons, clips, uniqueWords }: Props) {
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const dailyGoal = useSettingsStore(s => s.settings.dailyGoalMinutes);
  const [todaySeconds, setTodaySeconds] = useState(0);

  useEffect(() => {
    if (dailyGoal > 0) {
      getOverview().then(o => setTodaySeconds(o.today_seconds)).catch(() => {});
    }
  }, [dailyGoal]);
  const q = search.toLowerCase();
  const fL = lessons.filter(l => l.title.toLowerCase().includes(q) || l.subtitle.toLowerCase().includes(q));
  const fC = clips.filter(c => c.text.toLowerCase().includes(q) || c.note.toLowerCase().includes(q) || c.lessonTitle.toLowerCase().includes(q));
  const totalDuration = lessons.reduce((a,l)=>a+l.duration,0);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-12 pb-8" style={{ background: 'var(--hero-gradient)' }}>
        <div className="flex items-end justify-between gap-8">
          <div>
            <h1 className="text-3xl font-extrabold text-primary tracking-tight mb-2">欢迎回来</h1>
            <p className="text-tertiary text-sm">继续你的英语听力练习</p>
          </div>
          <div className="relative w-80">
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
          <div className="grid grid-cols-5 gap-4">
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
                      <button onClick={e=>{e.stopPropagation();favToggle({item_id:l.id,item_type:'audio',title:l.title,subtitle:l.subtitle});}}
                        className={`absolute top-1.5 right-1.5 p-1 rounded-full transition-colors cursor-pointer ${fav ? 'text-[var(--accent)]' : 'text-tertiary opacity-0 group-hover:opacity-100 hover:text-secondary'}`}>
                        <HiHeart size={14} />
                      </button>
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
  );
}
