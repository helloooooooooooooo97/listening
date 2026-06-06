import { useState, useEffect } from 'react';
import { HiMusicalNote, HiBookmark, HiBookOpen, HiMagnifyingGlass, HiClock, HiTrash } from 'react-icons/hi2';
import type { AudioClip, LessonSummary, ListeningLesson } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';
import type { NavSection } from './Sidebar';

interface Props {
  activeSection: NavSection;
  lessons: LessonSummary[];
  clips: AudioClip[];
  onDeleteClip: (id: string) => void;
}

function fmtDuration(s: number) { const m=Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('zh-CN',{month:'short',day:'numeric'}); }

export default function ContentPanel({ activeSection, lessons, clips, onDeleteClip }: Props) {
  const [search, setSearch] = useState('');
  const [uniqueWords, setUniqueWords] = useState(0);
  const [allWords, setAllWords] = useState<{word:string; count:number; lessons:string[]; lessonIds:string[]}[]>([]);
  const [wordsLoaded, setWordsLoaded] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/lessons/stats')
      .then(r => r.json())
      .then(s => setUniqueWords(s.uniqueWords))
      .catch(() => {});
  }, [lessons]);

  // Load all words for Words section
  useEffect(() => {
    if (wordsLoaded || lessons.length === 0) return;
    Promise.all(lessons.map(l => fetch(`/api/lessons/${l.id}`).then(r=>r.json())))
      .then(results => {
        const wordMap = new Map<string, {count:number; lessons:Set<string>; lessonIds:Set<string>}>();
        for (const lesson of results) {
          for (const w of (lesson as ListeningLesson).words) {
            const word = w.text.trim().toLowerCase();
            if (!word || ['.',',','!','?',';',':','-','"',"'",'—'].includes(word)) continue;
            const entry = wordMap.get(word) || {count:0, lessons:new Set(), lessonIds:new Set()};
            entry.count++;
            entry.lessons.add((lesson as ListeningLesson).title);
            entry.lessonIds.add((lesson as ListeningLesson).id);
            wordMap.set(word, entry);
          }
        }
        const sorted = [...wordMap.entries()]
          .map(([word, v]) => ({word, count: v.count, lessons: [...v.lessons], lessonIds: [...v.lessonIds]}))
          .sort((a,b) => b.count - a.count);
        setAllWords(sorted);
        setWordsLoaded(true);
      })
      .catch(() => {});
  }, [lessons, wordsLoaded]);
  const playLesson = useAudioStore(s => s.playLesson);
  const playClip = useAudioStore(s => s.playClip);

  const q = search.toLowerCase();
  const fLessons = lessons.filter(l => l.title.toLowerCase().includes(q) || l.subtitle.toLowerCase().includes(q));
  const fClips = clips.filter(c => c.text.toLowerCase().includes(q) || c.note.toLowerCase().includes(q) || c.lessonTitle.toLowerCase().includes(q));

  // ── Home ──
  if (activeSection === 'home') {
    const totalDuration = lessons.reduce((acc,l)=>acc+l.duration,0);
    const totalClips = clips.length;
    return (
      <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
        {/* Hero search */}
        <div className="flex-shrink-0 px-8 pt-12 pb-8" style={{ background: 'linear-gradient(180deg, #1a0a14 0%, #0d0d10 100%)' }}>
          <h1 className="text-3xl font-extrabold text-white tracking-tight mb-2">欢迎回来</h1>
          <p className="text-white/30 text-sm mb-6">继续你的英语听力练习</p>
          <div className="relative max-w-xl">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20"><HiMagnifyingGlass size={16} /></span>
            <input type="text" placeholder="全局搜索课程、片段..." value={search} onChange={e=>setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-[14px] bg-white/[0.06] border-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#fa2d48]/30 text-white placeholder:text-white/20" />
          </div>
          {/* Quick stats */}
          {q && (
            <p className="text-[12px] text-white/30 mt-3">
              找到 {fLessons.length} 节课程 · {fClips.length} 个片段
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          {/* Stats cards */}
          {!q && (
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: '课程', value: lessons.length, icon: HiBookOpen, color: '#fa2d48' },
                { label: '片段', value: totalClips, icon: HiBookmark, color: '#10b981' },
                { label: '句子', value: lessons.reduce((a,l)=>a+l.sentenceCount,0), icon: HiClock, color: '#f59e0b' },
                { label: '单词', value: uniqueWords, icon: HiMagnifyingGlass, color: '#8b5cf6' },
                { label: '总时长', value: `${Math.floor(totalDuration/60)}分`, icon: HiMusicalNote, color: '#3b82f6' },
              ].map(s=>(
                <div key={s.label} className="rounded-xl p-4 flex items-center gap-3" style={{background:'rgba(255,255,255,0.03)'}}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:`${s.color}20`}}>
                    <span style={{color:s.color}}><s.icon size={18} /></span>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white tracking-tight">{s.value}</p>
                    <p className="text-[11px] text-white/30">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Courses */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white tracking-tight">课程</h2>
              <button onClick={()=>useAudioStore.getState().clearMode()} className="text-[11px] text-white/30 hover:text-white/60 transition-colors cursor-pointer">查看全部</button>
            </div>
            {fLessons.length===0 ? (
              <p className="text-white/15 text-sm py-4">{q?'无匹配课程':'暂无课程'}</p>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {fLessons.slice(0,6).map(lesson=>(
                  <div key={lesson.id}
                    onClick={()=>{fetch(`/api/lessons/${lesson.id}`).then(r=>r.json()).then((l:ListeningLesson)=>playLesson(l)).catch(()=>{});}}
                    className="group cursor-pointer rounded-lg p-2 transition-all duration-200 hover:bg-white/[0.04]">
                    <div className="w-full aspect-square rounded-md flex items-center justify-center mb-2"
                      style={{ background: 'linear-gradient(135deg, #2a1020, #1a0a10)' }}>
                      <span className="text-white/20 group-hover:text-white/40 transition-colors"><HiMusicalNote size={20}/></span>
                    </div>
                    <p className="text-[11px] font-semibold text-white/80 truncate">{lesson.title}</p>
                    <p className="text-[10px] text-white/30 truncate mt-0.5">{lesson.subtitle}</p>
                    <span className="inline-block mt-1 text-[9px] font-medium px-1 py-0.5 rounded bg-white/[0.05] text-white/35">{lesson.level}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent clips */}
          {!q && clips.length>0 && (
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight mb-3">最近片段</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {clips.slice(0,4).map(clip=>{
                  const d=clip.endTime-clip.startTime;
                  return (
                    <div key={clip.id} onClick={()=>playClip(clip)}
                      className="group cursor-pointer rounded-xl p-4 transition-all duration-200 hover:bg-white/[0.04]" style={{background:'rgba(255,255,255,0.02)'}}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{background:'linear-gradient(135deg,#0a2a1a,#051a10)'}}>
                          <span className="text-white/30"><HiBookmark size={16}/></span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-white/70 leading-relaxed line-clamp-2">"{clip.text}"</p>
                          <p className="text-[10px] text-white/25 mt-1">{clip.lessonTitle} · {d.toFixed(1)}s · {fmtDate(clip.createdAt)}</p>
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

  // ── Courses ──
  if (activeSection === 'courses') {
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
          {fLessons.length===0 ? (
            <p className="text-center text-white/20 py-16">{search?'无匹配课程':'暂无课程'}</p>
          ) : (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {fLessons.map(lesson => (
                <div key={lesson.id}
                  onClick={() => {
                    fetch(`/api/lessons/${lesson.id}`).then(r=>r.json()).then((l:ListeningLesson)=>playLesson(l)).catch(()=>{});
                  }}
                  className="group cursor-pointer rounded-lg p-2 transition-all duration-200 hover:bg-white/[0.04]">
                  <div className="w-full aspect-square rounded-md flex items-center justify-center mb-1.5"
                    style={{ background: 'linear-gradient(135deg, #2a1020, #1a0a10)' }}>
                    <HiMusicalNote size={22}/>
                  </div>
                  <p className="text-[11px] font-semibold text-white/80 truncate">{lesson.title}</p>
                  <p className="text-[10px] text-white/30 truncate mt-0.5">{lesson.subtitle}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-white/[0.05] text-white/35">{lesson.level}</span>
                    <span className="text-[9px] text-white/20">{fmtDuration(lesson.duration)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Clips ──
  if (activeSection === 'clips') {
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
          {fClips.length===0 ? (
            <div className="text-center py-16">
              <HiBookmark size={40}/>
              <p className="text-white/20 text-sm">{search?'无匹配片段':'还没有片段'}</p>
              <p className="text-white/10 text-xs mt-1">在课程曲目表中点击 📌 保存句子</p>
            </div>
          ) : (
            <div className="space-y-5">
              {(()=>{
                const g=new Map<string,AudioClip[]>();
                for(const c of fClips) g.set(c.lessonId,[...(g.get(c.lessonId)||[]),c]);
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
                                <HiBookmark size={16}/>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] text-white/70 leading-relaxed line-clamp-2">"{clip.text}"</p>
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[10px] text-white/30">{d.toFixed(1)}s · {fmtDate(clip.createdAt)}</span>
                                  {clip.note&&<span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40">{clip.note}</span>}
                                </div>
                              </div>
                              <button onClick={e=>{e.stopPropagation();onDeleteClip(clip.id);}}
                                className="text-white/10 hover:text-[#fa2d48] transition-colors opacity-0 group-hover:opacity-100"><HiTrash size={13}/></button>
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

  // ── Words ──
  if (activeSection === 'words') {
    const fWords = allWords.filter(w => w.word.includes(q));
    const wordDetail = selectedWord ? allWords.find(w => w.word === selectedWord) : null;

    return (
      <div className="h-full flex bg-[#0a0a0b] overflow-hidden">
        {/* Word list */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-6 pt-10 pb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-white tracking-tight">单词</h1>
                <p className="text-white/25 text-xs mt-1">{allWords.length} 个不同单词 · 按频率排序</p>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/15"><HiMagnifyingGlass size={13} /></span>
                <input type="text" placeholder="搜索单词" value={search} onChange={e=>setSearch(e.target.value)}
                  className="w-48 pl-8 pr-3 py-1.5 text-[12px] bg-white/[0.05] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-white placeholder:text-white/15"/>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-8">
            {allWords.length===0 ? (
              <p className="text-white/15 text-sm py-16 text-center">加载中...</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {fWords.map(w => (
                  <button key={w.word}
                    onClick={() => setSelectedWord(w.word)}
                    className={`rounded-lg px-3 py-1.5 transition-all duration-200 cursor-pointer ${
                      selectedWord===w.word
                        ? 'bg-[#fa2d48]/20 ring-1 ring-[#fa2d48]/30'
                        : 'hover:bg-white/[0.04]'
                    }`}
                    style={{background: selectedWord===w.word ? 'rgba(250,45,72,0.15)' : 'rgba(255,255,255,0.02)'}}>
                    <span className="text-[13px] font-medium text-white/80">{w.word}</span>
                    <span className="text-[10px] text-white/25 ml-1.5">{w.count}</span>
                  </button>
                ))}
                {fWords.length===0 && q && <p className="text-white/15 text-sm py-8 text-center w-full">无匹配单词</p>}
              </div>
            )}
          </div>
        </div>

        {/* Word detail panel */}
        <div className="w-80 flex-shrink-0 border-l border-white/[0.05] flex flex-col overflow-hidden" style={{background:'rgba(255,255,255,0.01)'}}>
          {wordDetail ? (
            <div className="flex flex-col h-full">
              <div className="flex-shrink-0 px-5 pt-10 pb-4">
                <h2 className="text-3xl font-bold text-white tracking-tight">{wordDetail.word}</h2>
                <p className="text-white/25 text-xs mt-1">出现 {wordDetail.count} 次 · {wordDetail.lessons.length} 节课</p>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
                {/* Lesson list */}
                <div>
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.15em] mb-2">出现课程</p>
                  <div className="space-y-1">
                    {wordDetail.lessons.map((title, i) => (
                      <button key={i}
                        onClick={() => {
                          const lid = wordDetail.lessonIds[i];
                          if (lid) {
                            fetch(`/api/lessons/${lid}`).then(r=>r.json()).then((l:ListeningLesson)=>playLesson(l)).catch(()=>{});
                          }
                        }}
                        className="w-full text-left px-3 py-1.5 rounded-md text-[12px] text-white/50 hover:bg-white/[0.04] hover:text-white/70 transition-colors cursor-pointer truncate">
                        {title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-white/10 text-xs">← 点击单词查看详情</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Recent ──
  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-8 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-white tracking-tight">最近播放</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {lessons.length===0 ? (
          <div className="text-center py-16">
            <HiClock size={40}/>
            <p className="text-white/20 text-sm">还没有播放记录</p>
            <p className="text-white/10 text-xs mt-1">选择课程开始播放后会自动记录</p>
          </div>
        ) : (
          <div className="space-y-1">
            {lessons.slice(0,10).map((lesson,i)=>(
              <div key={lesson.id} onClick={()=>{
                fetch(`/api/lessons/${lesson.id}`).then(r=>r.json()).then((l:ListeningLesson)=>playLesson(l)).catch(()=>{});
              }}
                className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/[0.03] transition-colors group">
                <span className="text-[12px] text-white/15 tabular-nums w-5">{i+1}</span>
                <div className="w-9 h-9 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #1a0a14, #0a0a0b)' }}>
                  <HiMusicalNote size={13}/>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white/70 truncate">{lesson.title}</p>
                  <p className="text-[11px] text-white/25 truncate">{lesson.subtitle} · {lesson.level}</p>
                </div>
                <span className="text-[11px] text-white/20">{fmtDuration(lesson.duration)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
