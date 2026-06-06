import { useState } from 'react';
import { HiMusicalNote, HiMagnifyingGlass, HiHeart } from 'react-icons/hi2';
import type { LessonSummary } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { getLessonById } from '../lib/api';

interface Props {
  lessons: LessonSummary[];
}

function fmtDuration(s: number) { const m = Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

export default function CoursesView({ lessons }: Props) {
  const [search, setSearch] = useState('');
  const playLesson = useAudioStore(s => s.playLesson);
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const q = search.toLowerCase();
  const fL = lessons.filter(l => l.title.toLowerCase().includes(q) || l.subtitle.toLowerCase().includes(q));

  // Group by category
  const grouped = fL.reduce((acc, l) => {
    const cat = l.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(l);
    return acc;
  }, {} as Record<string, LessonSummary[]>);

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">音频</h1>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/15"><HiMagnifyingGlass size={13} /></span>
            <input type="text" placeholder="搜索音频" value={search} onChange={e=>setSearch(e.target.value)}
              className="w-56 pl-8 pr-3 py-1.5 text-[12px] bg-white/[0.05] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-white placeholder:text-white/15"/>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {fL.length===0 ? <p className="text-center text-white/20 py-16">{search?'无匹配音频':'暂无音频'}</p> : (
          Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-bold text-white/50 uppercase tracking-wider">{category}</h2>
                <span className="text-[11px] text-white/20">{items.length} 节</span>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                {items.map(l=>{
                  const fav = isFav(l.id, 'audio');
                  return (
                  <div key={l.id} onClick={()=>getLessonById(l.id).then(d=>playLesson(d))}
                    className="group cursor-pointer rounded-lg p-1.5 transition-all duration-200 hover:bg-white/[0.04]">
                    <div className="w-full aspect-square rounded-md flex items-center justify-center mb-1 relative"
                      style={{ background: category.includes('IELTS') ? 'linear-gradient(135deg, #1a1a2e, #0d0d1a)' : 'linear-gradient(135deg, #2a1020, #1a0a10)' }}>
                      <HiMusicalNote size={18}/>
                      <button onClick={e=>{e.stopPropagation();favToggle({item_id:l.id,item_type:'audio',title:l.title,subtitle:l.subtitle});}}
                        className={`absolute top-1.5 right-1.5 p-1 rounded-full transition-colors cursor-pointer ${fav ? 'text-[#fa2d48]' : 'text-white/15 opacity-0 group-hover:opacity-100 hover:text-white/40'}`}>
                        <HiHeart size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] font-semibold text-white/80 truncate">{l.title}</p>
                    <p className="text-[9px] text-white/30 truncate">{l.subtitle}</p>
                    <span className="inline-block mt-0.5 text-[8px] font-medium px-1 py-0.5 rounded bg-white/[0.05] text-white/35">
                      {l.level} · {fmtDuration(l.duration)}
                    </span>
                  </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
