import { useState, useEffect, useCallback, useRef } from 'react';
import { HiMagnifyingGlass, HiPlay, HiCheck, HiBarsArrowDown, HiHeart } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { getWords, getKnownWords, setWordKnown, type WordItem } from '../lib/api';

function fmtTime(s: number) { const m=Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

const PAGE_SIZE = 100;
type SortMode = 'freq-desc' | 'freq-asc';
const SORT_LABELS: Record<SortMode, string> = { 'freq-desc': '频率 ↓', 'freq-asc': '频率 ↑' };

export default function WordsView() {
  const [search, setSearch] = useState('');
  const [words, setWords] = useState<WordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('freq-desc');
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const [selected, setSelected] = useState<WordItem | null>(null);
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());

  // Load known words from API
  useEffect(() => {
    getKnownWords()
      .then(words => setKnownWords(new Set(words)))
      .catch(() => {});
  }, []);
  const viewClip = useAudioStore(s => s.viewClip);
  const togglePlay = useAudioStore(s => s.togglePlay);
  const wordOffset = useSettingsStore(s => s.settings.wordPlayOffset);
  const loaderRef = useRef<HTMLDivElement>(null);

  const loadWords = useCallback((query: string, sm: SortMode, off: number, append: boolean) => {
    if (off === 0) setLoading(true);
    else setLoadingMore(true);
    const order = sm === 'freq-asc' ? 'asc' : 'desc';
    getWords({ sort: 'freq', order, limit: PAGE_SIZE, offset: off, q: query || undefined })
      .then(data => {
        setWords(prev => append ? [...prev, ...data.words] : data.words);
        setTotal(data.total);
        setLoading(false);
        setLoadingMore(false);
      })
      .catch(() => { setLoading(false); setLoadingMore(false); });
  }, []);

  // Initial load + sort change
  useEffect(() => { setOffset(0); loadWords(search, sortMode, 0, false); }, [sortMode]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => { setOffset(0); loadWords(search, sortMode, 0, false); }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading && !loadingMore && words.length < total) {
        const newOff = offset + PAGE_SIZE;
        setOffset(newOff);
        loadWords(search, sortMode, newOff, true);
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadingMore, words.length, total, search, sortMode, offset, loadWords]);

  const toggleKnown = (word: string) => {
    const known = !knownWords.has(word);
    setKnownWords(prev => {
      const next = new Set(prev);
      if (known) next.add(word); else next.delete(word);
      return next;
    });
    // Sync to backend
    setWordKnown(word, known).catch(() => {});
  };

  const handlePlayAt = (lessonId: string, lessonTitle: string, word: string, time: number) => {
    const st = Math.max(0, time - wordOffset);
    const et = time + wordOffset;
    viewClip({ id: '', lessonId, lessonTitle, startWordId: '', endWordId: '', startTime: st, endTime: et, text: word, note: 'word', createdAt: '' });
    setTimeout(() => togglePlay(), 200);
  };

  const knownCount = knownWords.size;
  const groupedOccurrences = selected
    ? selected.lessons.reduce((acc, l) => ({ ...acc, [l.id]: { title: l.title, times: l.occurrences } }), {} as Record<string, {title:string; times:number[]}>)
    : {};

  return (
    <div className="h-full flex bg-[#0a0a0b] overflow-hidden">
      {/* Word list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 px-6 pt-10 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">单词</h1>
              <p className="text-white/25 text-xs mt-1">
                {total} 个单词 · 已掌握 {knownCount}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Sort toggle */}
              <button onClick={() => setSortMode(s => s === 'freq-desc' ? 'freq-asc' : 'freq-desc')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-white/40 hover:text-white/70 transition-colors cursor-pointer"
                title="切换排序">
                <HiBarsArrowDown size={13} style={{ transform: sortMode === 'freq-asc' ? 'rotate(180deg)' : '' }} />
                {SORT_LABELS[sortMode]}
              </button>
              {/* Search */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/15"><HiMagnifyingGlass size={13} /></span>
                <input type="text" placeholder="搜索" value={search} onChange={e=>setSearch(e.target.value)}
                  className="w-40 pl-8 pr-3 py-1.5 text-[12px] bg-white/[0.05] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-white placeholder:text-white/15"/>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {loading ? (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
              {Array.from({length: 40}).map((_,i)=>(
                <div key={i} className="h-8 rounded-lg bg-white/[0.03] animate-pulse" style={{animationDelay:`${i*20}ms`}}/>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                {words.map(w => (
                  <div key={w.word}
                    className={`rounded-lg px-3 py-1.5 transition-all duration-200 cursor-pointer text-[13px] flex items-center justify-between gap-1 group ${
                      selected?.word===w.word
                        ? 'bg-[#fa2d48]/15 ring-1 ring-[#fa2d48]/30 text-white'
                        : 'bg-white/[0.02] text-white/60 hover:bg-white/[0.05] hover:text-white/80'
                    }`}>
                    <span className="truncate flex-1" onClick={() => setSelected(w)}>{w.word}</span>
                    <span className="text-[10px] text-white/20 flex-shrink-0 flex items-center gap-0.5">
                      <button onClick={e=>{e.stopPropagation();favToggle({item_id:w.word,item_type:'word',title:w.word,subtitle:`${w.count}次`});}}
                        className={`transition-colors cursor-pointer ${isFav(w.word,'word') ? 'text-[#fa2d48]' : 'text-white/10 opacity-0 group-hover:opacity-100 hover:text-white/30'}`}>
                        <HiHeart size={10} />
                      </button>
                      {w.count}
                      {knownWords.has(w.word) && (
                        <HiCheck size={10} className="text-emerald-400" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
              {/* Loader trigger */}
              <div ref={loaderRef} className="h-4" />
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
                </div>
              )}
              {words.length===0&&!loading&&<p className="text-white/15 text-sm py-8">无匹配单词</p>}
            </>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="w-96 flex-shrink-0 border-l border-white/[0.05] flex flex-col overflow-hidden" style={{background:'rgba(255,255,255,0.01)'}}>
        {selected ? (
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 px-5 pt-10 pb-4 border-b border-white/[0.04]">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-white">{selected.word}</h2>
                  <p className="text-white/25 text-xs mt-1">出现 {selected.count} 次 · {selected.lessons.length} 节课</p>
                </div>
                <button onClick={() => toggleKnown(selected.word)}
                  className={`mt-1 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                    knownWords.has(selected.word)
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-white/[0.04] text-white/30 hover:text-white/60'
                  }`}>
                  {knownWords.has(selected.word) ? '✓ 已掌握' : '标记掌握'}
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {Object.entries(groupedOccurrences).map(([lid, g]) => (
                <div key={lid}>
                  <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.15em] mb-2">{g.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.times.map((t, i) => (
                      <button key={i}
                        onClick={() => handlePlayAt(lid, g.title, selected.word, t)}
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
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-white/10 text-xs">← 点击单词查看详情</p>
              <div className="mt-4 space-y-2 text-[10px] text-white/10">
                <p>大字 = 高频词</p>
                <p>✓ = 已掌握</p>
                <p>滚动加载更多</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
