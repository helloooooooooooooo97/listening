import { useState } from 'react';
import { HiBookmark, HiMagnifyingGlass, HiTrash, HiHeart } from 'react-icons/hi2';
import type { AudioClip } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';
import { useFavoritesStore } from '../stores/favoritesStore';

interface Props {
  clips: AudioClip[];
  onDeleteClip: (id: string) => void;
}

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}); }

export default function ClipsView({ clips, onDeleteClip }: Props) {
  const [search, setSearch] = useState('');
  const playClip = useAudioStore(s => s.playClip);
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const q = search.toLowerCase();
  const fC = clips.filter(c => c.text.toLowerCase().includes(q) || c.note.toLowerCase().includes(q) || c.lessonTitle.toLowerCase().includes(q));

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">片段</h1>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/15"><HiMagnifyingGlass size={13} /></span>
            <input type="text" placeholder="搜索片段" value={search} onChange={e=>setSearch(e.target.value)}
              className="w-56 pl-8 pr-3 py-1.5 text-[12px] bg-white/[0.05] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-white placeholder:text-white/15"/>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {fC.length===0 ? (
          <div className="text-center py-16">
            <HiBookmark size={40} className="text-white/10 mx-auto mb-4"/>
            <p className="text-white/20 text-sm">{search?'无匹配片段':'还没有片段'}</p>
            <p className="text-white/10 text-xs mt-1">在底部栏展开歌词后拖拽选词保存</p>
          </div>
        ) : (
          <div className="space-y-5">
            {(()=>{
              const g=new Map<string,AudioClip[]>();
              for(const c of fC) g.set(c.lessonId,[...(g.get(c.lessonId)||[]),c]);
              return [...g.entries()].map(([lid,group])=>(
                <div key={lid}>
                  <p className="text-[11px] font-semibold text-white/25 uppercase tracking-wider mb-2">{group[0].lessonTitle} · {group.length} 个片段</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.map(clip=>{
                      const d=clip.endTime-clip.startTime;
                      return (
                        <div key={clip.id} onClick={()=>playClip(clip)}
                          className="group cursor-pointer rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.04]" style={{background:'rgba(255,255,255,0.02)'}}>
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'linear-gradient(135deg,#0a2a1a,#051a10)'}}>
                              <span className="text-white/30 group-hover:text-white/60 transition-colors"><HiBookmark size={16}/></span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] text-white/70 leading-relaxed line-clamp-2">"{clip.text}"</p>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] text-white/30">{d.toFixed(1)}s · {fmtDate(clip.createdAt)}</span>
                                {clip.note&&<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">{clip.note}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={e=>{e.stopPropagation();favToggle({item_id:clip.id,item_type:'clip',title:clip.text||clip.lessonTitle,subtitle:clip.lessonTitle,extra_data:JSON.stringify({lessonId:clip.lessonId,start:clip.startTime,end:clip.endTime})});}}
                                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${isFav(clip.id,'clip') ? 'text-[#fa2d48]' : 'text-white/10 opacity-0 group-hover:opacity-100 hover:text-white/30'}`}>
                                <HiHeart size={13} />
                              </button>
                              <button onClick={e=>{e.stopPropagation();onDeleteClip(clip.id);}}
                                className="text-white/10 hover:text-[#fa2d48] transition-colors opacity-0 group-hover:opacity-100"><HiTrash size={13}/></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
