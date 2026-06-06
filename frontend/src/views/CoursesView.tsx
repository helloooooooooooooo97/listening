import { useState } from 'react';
import { HiMusicalNote, HiMagnifyingGlass } from 'react-icons/hi2';
import type { LessonSummary, ListeningLesson } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';

interface Props {
  lessons: LessonSummary[];
}

function fmtDuration(s: number) { const m = Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

export default function CoursesView({ lessons }: Props) {
  const [search, setSearch] = useState('');
  const playLesson = useAudioStore(s => s.playLesson);
  const q = search.toLowerCase();
  const fL = lessons.filter(l => l.title.toLowerCase().includes(q) || l.subtitle.toLowerCase().includes(q));

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">课程</h1>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/15"><HiMagnifyingGlass size={13} /></span>
            <input type="text" placeholder="搜索课程" value={search} onChange={e=>setSearch(e.target.value)}
              className="w-56 pl-8 pr-3 py-1.5 text-[12px] bg-white/[0.05] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-white placeholder:text-white/15"/>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {fL.length===0 ? <p className="text-center text-white/20 py-16">{search?'无匹配课程':'暂无课程'}</p> : (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
            {fL.map(l=>(
              <div key={l.id} onClick={()=>fetch(`/api/lessons/${l.id}`).then(r=>r.json()).then((d:ListeningLesson)=>playLesson(d))}
                className="group cursor-pointer rounded-lg p-2 transition-all duration-200 hover:bg-white/[0.04]">
                <div className="w-full aspect-square rounded-md flex items-center justify-center mb-1.5" style={{background:'linear-gradient(135deg,#2a1020,#1a0a10)'}}>
                  <HiMusicalNote size={22}/>
                </div>
                <p className="text-[11px] font-semibold text-white/80 truncate">{l.title}</p>
                <p className="text-[10px] text-white/30 truncate mt-0.5">{l.subtitle}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-white/[0.05] text-white/35">{l.level}</span>
                  <span className="text-[9px] text-white/20">{fmtDuration(l.duration)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
