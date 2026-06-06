import { HiMusicalNote, HiBookmark, HiBookOpen, HiMagnifyingGlass, HiClock } from 'react-icons/hi2';
import type { AudioClip, LessonSummary, ListeningLesson } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';

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
  const q = search.toLowerCase();
  const fL = lessons.filter(l => l.title.toLowerCase().includes(q) || l.subtitle.toLowerCase().includes(q));
  const fC = clips.filter(c => c.text.toLowerCase().includes(q) || c.note.toLowerCase().includes(q) || c.lessonTitle.toLowerCase().includes(q));
  const totalDuration = lessons.reduce((a,l)=>a+l.duration,0);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-12 pb-8" style={{ background: 'linear-gradient(180deg, #1a0a14 0%, #0d0d10 100%)' }}>
        <div className="flex items-end justify-between gap-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">欢迎回来</h1>
            <p className="text-white/30 text-sm">继续你的英语听力练习</p>
          </div>
          <div className="relative w-80">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"><HiMagnifyingGlass size={16} /></span>
            <input type="text" placeholder="搜索音频、片段..." value={search} onChange={e=>onSearchChange(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-[14px] bg-white/[0.06] border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#fa2d48]/30 text-white placeholder:text-white/20" />
          </div>
        </div>
        {q && <p className="text-[12px] text-white/30 mt-3">找到 {fL.length} 个音频 · {fC.length} 个片段</p>}
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
              <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={{background:'rgba(255,255,255,0.03)'}}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:`${s.color}20`}}>
                  <span style={{color:s.color}}><s.icon size={18} /></span>
                </div>
                <div><p className="text-2xl font-bold text-white tracking-tight">{s.value}</p><p className="text-[11px] text-white/30">{s.label}</p></div>
              </div>
            ))}
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-white tracking-tight">音频</h2>
          </div>
          {fL.length===0 ? <p className="text-white/15 text-sm py-4">{q?'无匹配音频':'暂无音频'}</p> : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {fL.slice(0,6).map(l=>(
                <div key={l.id} onClick={()=>fetch(`/api/lessons/${l.id}`).then(r=>r.json()).then((d:ListeningLesson)=>playLesson(d))}
                  className="group cursor-pointer rounded-lg p-2 transition-all duration-200 hover:bg-white/[0.04]">
                  <div className="w-full aspect-square rounded-md flex items-center justify-center mb-2" style={{background:'linear-gradient(135deg,#2a1020,#1a0a10)'}}>
                    <span className="text-white/20 group-hover:text-white/40 transition-colors"><HiMusicalNote size={20}/></span>
                  </div>
                  <p className="text-[11px] font-semibold text-white/80 truncate">{l.title}</p>
                  <p className="text-[10px] text-white/30 truncate mt-0.5">{l.subtitle}</p>
                  <span className="inline-block mt-1 text-[9px] font-medium px-1 py-0.5 rounded bg-white/[0.05] text-white/35">{l.level}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {!q && clips.length>0 && (
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight mb-3">最近片段</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {clips.slice(0,4).map(c=>{
                const d=c.endTime-c.startTime;
                return (
                  <div key={c.id} onClick={()=>playClip(c)}
                    className="group cursor-pointer rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.04]" style={{background:'rgba(255,255,255,0.02)'}}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'linear-gradient(135deg,#0a2a1a,#051a10)'}}>
                        <span className="text-white/30"><HiBookmark size={16}/></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-white/70 leading-relaxed line-clamp-2">"{c.text}"</p>
                        <p className="text-[10px] text-white/25 mt-1">{c.lessonTitle} · {d.toFixed(1)}s · {fmtDate(c.createdAt)}</p>
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
