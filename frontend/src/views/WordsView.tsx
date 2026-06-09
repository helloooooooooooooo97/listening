import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { HiMagnifyingGlass, HiPlay, HiCheck, HiBarsArrowDown, HiHeart, HiXMark, HiAdjustmentsHorizontal } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { getWords, getWordDetail, getKnownWords, setWordKnown, getLessons, getCollections, getDueWords, submitWordReview, type WordSummary, type WordDetail, type DueWord } from '../lib/api';

function fmtTime(s: number) { const m=Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

const PAGE_SIZE = 100;
type SortMode = 'freq-desc' | 'freq-asc';
const SORT_LABELS: Record<SortMode, string> = { 'freq-desc': '频率 ↓', 'freq-asc': '频率 ↑' };

export default function WordsView() {
  const [search, setSearch] = useState('');
  const [words, setWords] = useState<WordSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [sortMode, setSortMode] = useState<SortMode>('freq-desc');
  const [categoryFilter, setCategoryFilter] = useState<Set<string>>(new Set());
  const [collectionFilter, setCollectionFilter] = useState<string>('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [collections, setCollections] = useState<{id: number; name: string; dynamic_type: string}[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});
  const [reviewFilter, setReviewFilter] = useState(false);
  const [dueWords, setDueWords] = useState<DueWord[]>([]);
  const [dueWordsLoading, setDueWordsLoading] = useState(false);
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const [selected, setSelected] = useState<WordDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
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

  const loadWords = useCallback((query: string, sm: SortMode, off: number, append: boolean, cat?: string, coll?: string) => {
    if (off === 0) setLoading(true);
    else setLoadingMore(true);
    const order = sm === 'freq-asc' ? 'asc' : 'desc';
    getWords({ sort: 'freq', order, limit: PAGE_SIZE, offset: off, q: query || undefined, category: cat, collection: coll })
      .then(data => {
        setWords(prev => append ? [...prev, ...data.words] : data.words);
        setTotal(data.total);
        setLoading(false);
        setLoadingMore(false);
      })
      .catch(() => { setLoading(false); setLoadingMore(false); });
  }, []);

  // Load due words when review filter is active
  useEffect(() => {
    if (!reviewFilter) return;
    setDueWordsLoading(true);
    getDueWords(50)
      .then(data => setDueWords(data.words))
      .catch(() => {})
      .finally(() => setDueWordsLoading(false));
  }, [reviewFilter]);

  // Initial load + sort/ category/ collection change (ignored when reviewFilter is on)
  useEffect(() => {
    if (reviewFilter) return;
    setOffset(0);
    const cat = [...categoryFilter][0] || undefined;
    const coll = collectionFilter || undefined;
    loadWords(search, sortMode, 0, false, cat, coll);
  }, [sortMode, categoryFilter, collectionFilter, reviewFilter]);

  // Search with debounce
  useEffect(() => {
    if (reviewFilter) return;
    const timer = setTimeout(() => {
      setOffset(0);
      const cat = [...categoryFilter][0] || undefined;
      const coll = collectionFilter || undefined;
      loadWords(search, sortMode, 0, false, cat, coll);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, reviewFilter]);

  // Infinite scroll — volatile state (loading/wordsLen/total) via ref to avoid observer re-creation loop
  const obsRef = useRef({ loading: false, loadingMore: false, wordsLen: 0, total: 0 });
  obsRef.current = { loading, loadingMore, wordsLen: words.length, total };
  useEffect(() => {
    const el = loaderRef.current;
    if (!el || reviewFilter) return;
    const observer = new IntersectionObserver(entries => {
      const s = obsRef.current;
      if (entries[0].isIntersecting && !s.loading && !s.loadingMore && s.wordsLen < s.total) {
        const newOff = s.wordsLen;
        setOffset(newOff);
        loadWords(search, sortMode, newOff, true, [...categoryFilter][0] || undefined, collectionFilter || undefined);
      }
    }, { rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [reviewFilter, loadWords, search, sortMode, categoryFilter, collectionFilter]);

  const toggleKnown = (word: string) => {
    const known = !knownWords.has(word);
    setKnownWords(prev => {
      const next = new Set(prev);
      if (known) next.add(word); else next.delete(word);
      return next;
    });
    setWordKnown(word, known).catch(() => {});
  };

  const handlePlayAt = (lessonId: string, lessonTitle: string, word: string, time: number) => {
    const st = Math.max(0, time - wordOffset);
    const et = time + wordOffset;
    viewClip({ id: '', lessonId, lessonTitle, startWordId: '', endWordId: '', startTime: st, endTime: et, text: word, note: 'word', color: '#facc15', createdAt: '' });
    setTimeout(() => togglePlay(), 200);
  };

  const handleSelectWord = (w: WordSummary) => {
    // Already showing this word — no-op
    if (selected?.word === w.word) return;
    // Optimistic: immediately highlight word while detail loads
    if (detailCache.current.has(w.word)) {
      setSelected(detailCache.current.get(w.word)!);
      return;
    }
    setLoadingDetail(true);
    getWordDetail(w.word)
      .then(detail => {
        detailCache.current.set(w.word, detail);
        setSelected(detail);
      })
      .catch(() => {})
      .finally(() => setLoadingDetail(false));
  };

  // Cache fetched word details to avoid re-fetching
  const detailCache = useRef(new Map<string, WordDetail>());

  const handleReviewWord = (word: string) => {
    // Mark as reviewed with a good score (simplified: user clicks = correct)
    submitWordReview(word, 100).catch(() => {});
    setDueWords(prev => prev.filter(d => d.word !== word));
    setKnownWords(prev => new Set(prev).add(word));
  };

  // Load available smart collections + lesson categories + word counts
  useEffect(() => {
    (async () => {
      const [lessons, cols] = await Promise.all([
        getLessons().catch(() => []),
        getCollections().catch(() => []),
      ]);
      const cats = [...new Set(lessons.map(l => l.category || 'Other'))].sort();
      setCategories(cats);
      const dynCols = cols.filter(c => c.is_dynamic && c.dynamic_type && !c.dynamic_type.startsWith('category:'));
      setCollections(dynCols);
      // Fetch counts for all filter options in parallel
      const counts: Record<string, number> = {};
      const results = await Promise.all([
        getWords({ limit: 10 }).catch(() => null), // all
        ...cats.map(cat => getWords({ limit: 10, collection: `category:${cat}` }).catch(() => null)),
        ...dynCols.map(col => getWords({ limit: 10, collection: col.dynamic_type }).catch(() => null)),
      ]);
      if (results[0]) counts['all'] = results[0].total;
      let idx = 1;
      for (const cat of cats) { if (results[idx]) counts[`cat:${cat}`] = results[idx].total; idx++; }
      for (const col of dynCols) { if (results[idx]) counts[`col:${col.dynamic_type}`] = results[idx].total; idx++; }
      setFilterCounts(counts);
    })();
  }, []);

  // When API handles filtering, words are already filtered
  const filteredWords = words;
  const displayTotal = total;

  const groupedOccurrences = selected
    ? selected.lessons.reduce((acc, l) => ({ ...acc, [l.id]: { title: l.title, times: l.occurrences } }), {} as Record<string, {title:string; times:number[]}>)
    : {};

  return (
    <div className="h-full flex bg-[var(--bg-primary)] overflow-hidden">
      {/* Word list — takes full width when panel is hidden */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selected ? 'md:mr-96' : ''}`}>
        <div className="flex-shrink-0 px-6 pt-10 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-extrabold text-primary tracking-tight">
                {reviewFilter ? '待复习' : '单词'}
              </h1>
              <p className="text-xs text-tertiary mt-0.5">
                {reviewFilter
                  ? `${dueWords.length} 个单词待复习`
                  : `共 ${displayTotal} 个单词${categoryFilter.size > 0 ? ` · ${[...categoryFilter].join('、')}` : ''}`
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Sort toggle */}
              <button onClick={() => setSortMode(s => s === 'freq-desc' ? 'freq-asc' : 'freq-desc')}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-secondary transition-colors cursor-pointer"
                title="切换排序">
                <HiBarsArrowDown size={13} style={{ transform: sortMode === 'freq-asc' ? 'rotate(180deg)' : '' }} />
                {SORT_LABELS[sortMode]}
              </button>
              {/* Collection / Category filter */}
              {(collections.length > 0 || categories.length > 0) && (
                <div className="relative">
                  <button onClick={() => setFilterOpen(!filterOpen)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                    title="按合集筛选">
                    <HiAdjustmentsHorizontal size={13} />
                    <span>{collectionFilter ? collections.find(c => c.dynamic_type === collectionFilter)?.name || categoryFilter.size > 0 ? [...categoryFilter][0] : '合集' : '合集'}</span>
                  </button>
                  {filterOpen && (
                    <div className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-2xl border border-[var(--border-primary)] overflow-hidden z-50 animate-fade-in"
                      style={{ background: 'var(--bg-secondary)' }}
                      onClick={e => e.stopPropagation()}>
                      <div className="p-2 space-y-0.5 max-h-72 overflow-y-auto">
                        <button onClick={() => { setCollectionFilter(''); setCategoryFilter(new Set()); setReviewFilter(false); setFilterOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                            !collectionFilter && categoryFilter.size === 0 && !reviewFilter ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                          }`}>
                          <span>全部单词</span>
                          <span className="text-[10px] font-mono tabular-nums opacity-60">{filterCounts['all'] ?? '…'}</span>
                        </button>
                        {/* Review filter */}
                        <button onClick={() => { setCollectionFilter(''); setCategoryFilter(new Set()); setReviewFilter(true); setFilterOpen(false); }}
                          className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                            reviewFilter ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                          }`}>
                          <span>📝 待复习</span>
                        </button>
                        {/* Smart collections */}
                        {collections.map(col => (
                          <button key={col.id} onClick={() => {
                            setCollectionFilter(col.dynamic_type);
                            setCategoryFilter(new Set());
                            setFilterOpen(false);
                          }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                              collectionFilter === col.dynamic_type ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                            }`}>
                            <span>{col.name}</span>
                            <span className="text-[10px] font-mono tabular-nums opacity-60">{filterCounts[`col:${col.dynamic_type}`] ?? '…'}</span>
                          </button>
                        ))}
                        {/* Lesson categories */}
                        {categories.map(cat => (
                          <button key={cat} onClick={() => {
                            setCollectionFilter('');
                            setCategoryFilter(new Set([cat]));
                            setFilterOpen(false);
                          }}
                            className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                              categoryFilter.has(cat) ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                            }`}>
                            <span>📚 {cat}</span>
                            <span className="text-[10px] font-mono tabular-nums opacity-60">{filterCounts[`cat:${cat}`] ?? '…'}</span>
                          </button>
                        ))}
                      </div>
                      {(collectionFilter || categoryFilter.size > 0 || reviewFilter) && (
                        <div className="border-t border-[var(--border-secondary)] p-2">
                          <button onClick={() => { setCollectionFilter(''); setCategoryFilter(new Set()); setReviewFilter(false); setFilterOpen(false); }}
                            className="w-full text-xs text-center py-1.5 rounded-lg text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                            清除筛选
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* Search */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"><HiMagnifyingGlass size={13} /></span>
                <input type="text" placeholder="搜索" value={search} onChange={e=>setSearch(e.target.value)}
                  className="w-40 pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-tertiary)] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-primary placeholder:text-tertiary"/>
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
            </div>
          ) : reviewFilter ? (
            <>
              {dueWordsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
                </div>
              ) : dueWords.length === 0 ? (
                <p className="text-tertiary text-sm py-8">暂无待复习单词 🎉</p>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                  {dueWords.map(d => (
                    <div key={d.word} className="rounded-lg px-3 py-1.5 text-[14px] bg-[var(--bg-tertiary)] flex items-center justify-between gap-1 group">
                      <span className="truncate flex-1 text-secondary">{d.word}</span>
                      <span className="flex items-center gap-1 flex-shrink-0">
                        {d.last_score != null && (
                          <span className={`text-[10px] font-mono ${d.last_score < 60 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {d.last_score}%
                          </span>
                        )}
                        <button onClick={() => handleReviewWord(d.word)}
                          className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                          复习
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-1.5">
                {words.map(w => (
                  <div key={w.word}
                    onClick={() => handleSelectWord(w)}
                    className={`rounded-lg px-3 py-1.5 transition-all duration-200 cursor-pointer text-[14px] flex items-center justify-between gap-1 group ${
                      selected?.word===w.word
                        ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/30 text-primary'
                        : 'bg-[var(--bg-tertiary)] text-secondary hover:bg-[var(--bg-tertiary)] hover:text-primary'
                    }`}>
                    <span className="truncate flex-1">{w.word}</span>
                    <span className="text-xs text-tertiary flex-shrink-0 flex items-center gap-0.5">
                      <button onClick={e=>{e.stopPropagation();favToggle({item_id:w.word,item_type:'word',title:w.word,subtitle:`${w.count}次`});}}
                        className={`transition-colors cursor-pointer ${isFav(w.word,'word') ? 'text-[var(--accent)]' : 'text-tertiary opacity-0 group-hover:opacity-100 hover:text-tertiary'}`}>
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
                  <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
                </div>
              )}
              {words.length===0&&!loading&&<p className="text-tertiary text-sm py-8">{categoryFilter.size > 0 ? '该类型暂无匹配单词' : '无匹配单词'}</p>}
            </>
          )}
        </div>
      </div>

      {/* Slide-in detail panel — desktop: right side, mobile: bottom sheet */}
      {(selected || loadingDetail) && (
        <>
          {/* Backdrop (mobile only) */}
          <div className="md:hidden fixed inset-0 z-40 bg-black/20" onClick={() => { setSelected(null); setLoadingDetail(false); }} />

          <div className={`fixed z-50 bg-[var(--bg-primary)] border-[var(--border-primary)] shadow-2xl flex flex-col overflow-hidden
            md:right-0 md:top-0 md:bottom-0 md:w-96 md:border-l md:animate-fade-in
            max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:max-h-[65vh] max-md:rounded-t-2xl max-md:border-t max-md:animate-slide-up`}
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-start justify-between px-5 pt-10 pb-4 border-b border-[var(--border-secondary)]">
              <div>
                {selected ? (
                  <>
                    <h2 className="text-3xl font-bold text-primary">{selected.word}</h2>
                    <p className="text-tertiary text-xs mt-1">出现 {selected.count} 次 · {selected.lessons.length} 节课</p>
                  </>
                ) : (
                  <>
                    <div className="h-9 w-24 rounded-lg bg-[var(--bg-tertiary)] animate-pulse mb-2" />
                    <div className="h-4 w-32 rounded bg-[var(--bg-tertiary)] animate-pulse" />
                  </>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selected && (
                  <button onClick={() => toggleKnown(selected.word)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      knownWords.has(selected.word)
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-[var(--bg-tertiary)] text-tertiary hover:text-secondary'
                    }`}>
                    {knownWords.has(selected.word) ? '✓ 已掌握' : '标记掌握'}
                  </button>
                )}
                <button onClick={() => setSelected(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                  <HiXMark size={16} />
                </button>
              </div>
            </div>

            {/* Occurrences */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
                </div>
              ) : selected && Object.entries(groupedOccurrences).map(([lid, g]) => (
                <div key={lid}>
                  <p className="text-xs font-bold text-tertiary uppercase tracking-[0.15em] mb-2">{g.title}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.times.map((t, i) => (
                      <button key={i}
                        onClick={() => handlePlayAt(lid, g.title, selected.word, t)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs text-secondary hover:text-white hover:bg-[var(--bg-hover)] transition-colors cursor-pointer font-mono"
                        title={`播放 ${fmtTime(t)}`}>
                        <HiPlay size={10} className="text-tertiary"/>
                        {fmtTime(t)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
