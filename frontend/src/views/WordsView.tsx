import { useState, useEffect } from 'react';
import { HiMagnifyingGlass, HiPlay } from 'react-icons/hi2';
import type { LessonSummary, ListeningLesson } from '../types/lesson';
import { useAudioStore } from '../stores/audioStore';
import { useSettingsStore } from '../stores/settingsStore';

interface Props {
  lessons: LessonSummary[];
}

interface WordOccurrence {
  lessonId: string;
  lessonTitle: string;
  start: number;
}

interface WordEntry {
  word: string;
  count: number;
  lessons: string[];
  lessonIds: string[];
  occurrences: WordOccurrence[];
}

function fmtTime(s: number) { const m=Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

export default function WordsView({ lessons }: Props) {
  const [search, setSearch] = useState('');
  const [allWords, setAllWords] = useState<WordEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<string|null>(null);
  const viewClip = useAudioStore(s => s.viewClip);
  const togglePlay = useAudioStore(s => s.togglePlay);
  const offset = useSettingsStore(s => s.settings.wordPlayOffset);
  const q = search.toLowerCase();

  useEffect(() => {
    if (loaded || lessons.length===0) return;
    Promise.all(lessons.map(l => fetch(`/api/lessons/${l.id}`).then(r=>r.json())))
      .then(results => {
        const m = new Map<string, {count:number;lessons:Set<string>;lessonIds:Set<string>;occurrences:WordOccurrence[]}>();
        for (const lesson of results) {
          const l = lesson as ListeningLesson;
          for (const w of l.words) {
            let word = w.text.trim().toLowerCase();
            // Strip leading/trailing punctuation
            word = word.replace(/^[.,!?;:\-"'—]+/, '').replace(/[.,!?;:\-"'—]+$/, '');
            if (!word) continue;
            const e = m.get(word) || {count:0,lessons:new Set(),lessonIds:new Set(),occurrences:[]};
            e.count++;
            e.lessons.add(l.title);
            e.lessonIds.add(l.id);
            e.occurrences.push({lessonId:l.id,lessonTitle:l.title,start:w.start});
            m.set(word, e);
          }
        }
        setAllWords([...m].map(([w,v])=>({
          word:w,count:v.count,
          lessons:[...v.lessons],lessonIds:[...v.lessonIds],
          occurrences:v.occurrences.sort((a,b)=>a.lessonTitle.localeCompare(b.lessonTitle)||a.start-b.start)
        })).sort((a,b)=>b.count-a.count));
        setLoaded(true);
      }).catch(()=>{});
  }, [lessons,loaded]);

  const fW = allWords.filter(w=>w.word.includes(q));
  const detail = selected ? allWords.find(w=>w.word===selected) : null;

  // Group occurrences by lesson
  const groupedOccurrences = detail
    ? detail.occurrences.reduce((acc, o) => {
        const key = o.lessonId;
        if (!acc[key]) acc[key] = { title: o.lessonTitle, times: [] as number[] };
        acc[key].times.push(o.start);
        return acc;
      }, {} as Record<string,{title:string;times:number[]}>)
    : {};

  const handlePlayAt = (lessonId: string, lessonTitle: string, word: string, time: number) => {
    const startTime = Math.max(0, time - offset);
    const endTime = time + offset;
    viewClip({ id: '', lessonId, lessonTitle, startWordId: '', endWordId: '', startTime, endTime, text: word, note: 'word', createdAt: '' });
    setTimeout(() => togglePlay(), 300);
  };

  return (
    <div className="h-full flex bg-[#0a0a0b] overflow-hidden">
      {/* Word cloud */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 pt-10 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div><h1 className="text-2xl font-extrabold text-white tracking-tight">单词</h1><p className="text-white/25 text-xs mt-1">{allWords.length} 个不同单词</p></div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/15"><HiMagnifyingGlass size={13} /></span>
              <input type="text" placeholder="搜索单词" value={search} onChange={e=>setSearch(e.target.value)}
                className="w-48 pl-8 pr-3 py-1.5 text-[12px] bg-white/[0.05] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-white placeholder:text-white/15"/>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {!loaded ? <p className="text-white/15 text-sm py-16 text-center">加载中...</p> : (
            <div className="flex flex-wrap gap-1.5">
              {fW.map(w=>(
                <button key={w.word} onClick={()=>setSelected(w.word)}
                  className={`rounded-lg px-3 py-1.5 transition-all duration-200 cursor-pointer text-[13px] font-medium ${
                    selected===w.word ? 'bg-[#fa2d48]/20 ring-1 ring-[#fa2d48]/30 text-white' : 'text-white/70 hover:bg-white/[0.04]'
                  }`}>
                  {w.word}<span className="text-[10px] text-white/25 ml-1.5">{w.count}</span>
                </button>
              ))}
              {fW.length===0&&q&&<p className="text-white/15 text-sm py-8 w-full">无匹配单词</p>}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="w-96 flex-shrink-0 border-l border-white/[0.05] flex flex-col overflow-hidden" style={{background:'rgba(255,255,255,0.01)'}}>
        {detail ? (
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-5 pt-10 pb-4 border-b border-white/[0.04]">
              <h2 className="text-3xl font-bold text-white">{detail.word}</h2>
              <p className="text-white/25 text-xs mt-1">出现 {detail.count} 次 · {detail.lessons.length} 节课</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {Object.entries(groupedOccurrences).map(([lid, g]) => (
                <div key={lid}>
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.15em] mb-2">{g.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.times.map((t, i) => (
                      <button key={i}
                        onClick={() => handlePlayAt(lid, g.title, detail.word, t)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer font-mono"
                        title={`播放 ${fmtTime(t)}`}>
                        <HiPlay size={10} className="text-white/30"/>
                        {fmtTime(t)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full"><p className="text-white/10 text-xs">← 点击单词查看出现位置</p></div>
        )}
      </div>
    </div>
  );
}
