import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { HiMagnifyingGlass, HiPlay, HiCheck, HiBarsArrowDown, HiHeart, HiXMark, HiAdjustmentsHorizontal, HiSun, HiArrowPath, HiSparkles, HiBookOpen } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useAiStore } from '../stores/aiStore';
import type { WordAnalysis } from '../types/lesson';
import { getWords, getWordDetail, getKnownWords, setWordKnown, getDueWords, submitWordReview, getTodayWords, getTodayStats, getWordSentences, type WordSummary, type WordDetail, type DueWord, type TodayWord, type TodayStats, type WordSentence } from '../lib/api';

function fmtTime(s: number) { const m=Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

const PAGE_SIZE = 100;
type SortMode = 'freq-desc' | 'freq-asc';
const SORT_LABELS: Record<SortMode, string> = { 'freq-desc': '频率 ↓', 'freq-asc': '频率 ↑' };

type WordTab = 'today' | 'all' | 'review' | 'mastered';

function TabBar({ active, onChange }: { active: WordTab; onChange: (t: WordTab) => void }) {
  const tabs: { key: WordTab; label: string; icon: React.ComponentType<{size?: number; className?: string}> }[] = [
    { key: 'today',    label: '今日单词', icon: HiSun },
    { key: 'all',      label: '全部单词', icon: HiBookOpen },
    { key: 'review',   label: '待复习',   icon: HiArrowPath },
    { key: 'mastered', label: '已掌握',   icon: HiCheck },
  ];
  return (
    <div className="flex gap-1">
      {tabs.map(t => {
        const Icon = t.icon;
        return (
          <button key={t.key} onClick={() => onChange(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              active === t.key
                ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
            }`}>
            <Icon size={13} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

export default function WordsView() {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<WordTab>('today');
  const [words, setWords] = useState<WordSummary[]>([]);
  const [todayWords, setTodayWords] = useState<TodayWord[]>([]);
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
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
  const [dueWords, setDueWords] = useState<DueWord[]>([]);
  const [masteredWords, setMasteredWords] = useState<WordSummary[]>([]);
  const [masteredLoading, setMasteredLoading] = useState(false);
  const [dueWordsLoading, setDueWordsLoading] = useState(false);
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const [selected, setSelected] = useState<WordDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [aiAnalysis, setAiAnalysis] = useState<WordAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const lookupWord = useAiStore(s => s.lookupWord);
  const hasAiProvider = useAiStore(s => s.providers.length > 0);

  // Load known words from API
  useEffect(() => {
    getKnownWords()
      .then(words => setKnownWords(new Set(words)))
      .catch(() => {});
  }, []);
  const viewClip = useAudioStore(s => s.viewClip);
  const togglePlay = useAudioStore(s => s.togglePlay);
  const wordOffset = useSettingsStore(s => s.settings.wordPlayOffset);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const detailCache = useRef(new Map<string, WordDetail>());

  // Load today's words + stats
  const loadTodayData = useCallback(() => {
    getTodayWords().then(d => {
      setTodayWords(d.words);
      // Switch to today tab if there are today's words
      if (d.words.length > 0 && tab === 'today') setLoading(false);
    }).catch(() => {});
    getTodayStats().then(setTodayStats).catch(() => {});
  }, [tab]);

  useEffect(() => {
    if (tab === 'today') {
      setLoading(true);
      loadTodayData();
      setLoading(false);
    }
  }, [tab, loadTodayData]);

  // Load all words
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

  // Load due words
  useEffect(() => {
    if (tab !== 'review') return;
    setDueWordsLoading(true);
    getDueWords(200)
      .then(data => setDueWords(data.words))
      .catch(() => {})
      .finally(() => setDueWordsLoading(false));
  }, [tab]);

  // Load mastered words
  useEffect(() => {
    if (tab !== 'mastered') return;
    setMasteredLoading(true);
    getWords({ collection: 'all_words', limit: 500 })
      .then(data => setMasteredWords(data.words))
      .catch(() => {})
      .finally(() => setMasteredLoading(false));
  }, [tab]);

  // Initial load for 'all' tab
  useEffect(() => {
    if (tab === 'all') {
      setOffset(0);
      const cat = [...categoryFilter][0] || undefined;
      const coll = collectionFilter || undefined;
      loadWords(search, sortMode, 0, false, cat, coll);
    }
  }, [tab, sortMode, categoryFilter, collectionFilter]);

  // Search
  useEffect(() => {
    if (tab !== 'all') return;
    const timer = setTimeout(() => {
      setOffset(0);
      const cat = [...categoryFilter][0] || undefined;
      const coll = collectionFilter || undefined;
      loadWords(search, sortMode, 0, false, cat, coll);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, tab]);

  // Infinite scroll (only for 'all' tab)
  const obsRef = useRef({ loading: false, loadingMore: false, wordsLen: 0, total: 0, tab: 'all' as WordTab });
  obsRef.current = { loading, loadingMore, wordsLen: words.length, total, tab };
  const loadMoreRef = useCallback((node: HTMLDivElement | null) => {
    const ob = observerRef.current;
    if (ob) { ob.disconnect(); observerRef.current = null; }
    if (!node || obsRef.current.tab !== 'all') return;
    observerRef.current = new IntersectionObserver(entries => {
      const s = obsRef.current;
      if (entries[0].isIntersecting && !s.loading && !s.loadingMore && s.wordsLen < s.total) {
        const newOff = s.wordsLen;
        setOffset(newOff);
        loadWords(search, sortMode, newOff, true, [...categoryFilter][0] || undefined, collectionFilter || undefined);
      }
    }, { rootMargin: '200px' });
    observerRef.current.observe(node);
  }, [loadWords, search, sortMode, categoryFilter, collectionFilter]);

  // Load collections & categories for filter
  useEffect(() => {
    (async () => {
      const { getLessons, getCollections } = await import('../lib/api');
      const [lessons, cols] = await Promise.all([
        getLessons().catch(() => []),
        getCollections().catch(() => []),
      ]);
      const cats = [...new Set(lessons.map(l => l.category || 'Other'))].sort();
      setCategories(cats);
      const dynCols = cols.filter(c => c.is_dynamic && c.dynamic_type && !c.dynamic_type.startsWith('category:'));
      setCollections(dynCols);
      const counts: Record<string, number> = {};
      const results = await Promise.all([
        getWords({ limit: 10 }).catch(() => null),
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
    if (selected?.word === w.word) return;
    setAiAnalysis(null);
    setAiExpanded(false);
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

  const handleAiLookup = async (word: string) => {
    if (aiAnalysis) { setAiExpanded(e => !e); return; }
    setAiLoading(true);
    try {
      const analysis = await lookupWord(word);
      setAiAnalysis(analysis as unknown as WordAnalysis);
      setAiExpanded(true);
    } catch {
      setAiAnalysis({ word, pronunciation: '', partOfSpeech: '', definition: 'AI 分析不可用，请检查 AI 设置', examples: [] });
      setAiExpanded(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleReviewWord = (word: string) => {
    submitWordReview(word, 100).catch(() => {});
    setDueWords(prev => prev.filter(d => d.word !== word));
    setKnownWords(prev => new Set(prev).add(word));
  };

  // ── Review modal state ──
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewQueue, setReviewQueue] = useState<TodayWord[]>([]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewComplete, setReviewComplete] = useState(false);
  const [reviewSentence, setReviewSentence] = useState<WordSentence | null>(null);
  const [reviewInput, setReviewInput] = useState('');
  const [reviewResult, setReviewResult] = useState<'correct' | 'wrong' | null>(null);
  const [reviewCorrectWord, setReviewCorrectWord] = useState('');
  const [reviewLoadingSentence, setReviewLoadingSentence] = useState(false);
  const reviewResults = useRef<{ word: string; score: number }[]>([]);

  const openReview = useCallback(() => {
    const unmastered = todayWords.filter(w => !knownWords.has(w.word));
    if (unmastered.length === 0) return;
    setReviewQueue(unmastered);
    setReviewIndex(0);
    setReviewRevealed(false);
    setReviewComplete(false);
    setReviewInput('');
    setReviewResult(null);
    reviewResults.current = [];
    setReviewOpen(true);
  }, [todayWords, knownWords]);

  // Load sentence context when review index changes + auto-play
  useEffect(() => {
    if (!reviewOpen || reviewComplete || reviewQueue.length === 0) return;
    const word = reviewQueue[reviewIndex]?.word;
    if (!word) return;
    setReviewLoadingSentence(true);
    setReviewSentence(null);
    setReviewInput('');
    setReviewResult(null);
    setReviewRevealed(false);
    getWordSentences(word)
      .then(data => {
        if (data.sentences.length > 0) {
          const sent = data.sentences[0];
          setReviewSentence(sent);
          // Auto-play the sentence audio
          const st = Math.max(0, sent.start_time);
          const et = sent.end_time + 0.5;
          viewClip({ id: '', lessonId: sent.lesson_id, lessonTitle: sent.lesson_title, startWordId: '', endWordId: '', startTime: st, endTime: et, text: sent.sentence_text, note: 'review', color: '#facc15', createdAt: '' });
          setTimeout(() => togglePlay(), 300);
        }
      })
      .catch(() => {})
      .finally(() => setReviewLoadingSentence(false));
  }, [reviewOpen, reviewIndex, reviewQueue, reviewComplete, viewClip, togglePlay]);

  const handleCheckAnswer = () => {
    const word = reviewQueue[reviewIndex].word;
    // Clean both sides for comparison (listened_words may have trailing punctuation)
    const cleaned = word.replace(/^[.,!?;:\-"'“”‘’—]+|[.,!?;:\-"'“”‘’—]+$/g, '').toLowerCase();
    const isCorrect = reviewInput.trim().toLowerCase() === cleaned;
    setReviewResult(isCorrect ? 'correct' : 'wrong');
    setReviewCorrectWord(word);
    setReviewRevealed(true);
  };

  const handleNextWord = () => {
    const word = reviewQueue[reviewIndex].word;
    const score = reviewResult === 'correct' ? 100 : 0;
    submitWordReview(word, score).catch(() => {});
    reviewResults.current.push({ word, score });
    setKnownWords(prev => new Set(prev).add(word));
    setTodayWords(prev => prev.map(w => w.word === word ? { ...w, known: 1, last_score: score } : w));

    if (reviewIndex + 1 >= reviewQueue.length) {
      setReviewComplete(true);
    } else {
      setReviewIndex(i => i + 1);
    }
  };

  const closeReview = () => {
    setReviewOpen(false);
    setReviewComplete(false);
  };

  // Clean punctuation from word for matching (word in listened_words may have trailing comma, period etc.)
  const cleanWord = useMemo(() => {
    const word = reviewQueue[reviewIndex]?.word || '';
    return word.replace(/^[.,!?;:\-"'“”‘’—]+|[.,!?;:\-"'“”‘’—]+$/g, '').toLowerCase();
  }, [reviewQueue, reviewIndex]);

  // Replace target word with blank (word boundaries only — avoid "or" matching "for")
  const highlightedSentence = useMemo(() => {
    if (!reviewSentence) return '';
    if (!cleanWord) return reviewSentence.sentence_text;
    const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    return reviewSentence.sentence_text.replace(regex, '___');
  }, [reviewSentence, cleanWord]);

  const groupedOccurrences = selected
    ? selected.lessons.reduce((acc, l) => ({ ...acc, [l.id]: { title: l.title, times: l.occurrences } }), {} as Record<string, {title:string; times:number[]}>)
    : {};

  // Count today's unmastered words
  const todayUnmastered = todayWords.filter(w => !knownWords.has(w.word));
  const todayMasteredCount = todayWords.filter(w => knownWords.has(w.word)).length;

  return (
    <div className="h-full flex bg-[var(--bg-primary)] overflow-hidden">
      {/* Word list */}
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-300 ${selected ? 'md:mr-96' : ''}`}>
        <div className="flex-shrink-0 px-6 pt-10 pb-4">
          {/* Tabs */}
          <div className="flex items-center justify-between mb-3">
            <TabBar active={tab} onChange={t => { setTab(t); setSearch(''); }} />
            <div className="flex items-center gap-2">
              {tab === 'today' && todayStats && (
                <span className="text-xs text-tertiary tabular-nums">
                  今日 {todayStats.total_words} 词 · 已复习 {todayStats.reviewed_count}
                </span>
              )}
              {tab === 'all' && (
                <>
                  {/* Sort toggle */}
                  <button onClick={() => setSortMode(s => s === 'freq-desc' ? 'freq-asc' : 'freq-desc')}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-secondary transition-colors cursor-pointer"
                    title="切换排序">
                    <HiBarsArrowDown size={13} style={{ transform: sortMode === 'freq-asc' ? 'rotate(180deg)' : '' }} />
                    {SORT_LABELS[sortMode]}
                  </button>
                  {/* Filter button */}
                  {(collections.length > 0 || categories.length > 0) && (
                    <div className="relative">
                      <button onClick={() => setFilterOpen(!filterOpen)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                        title="按合集筛选">
                        <HiAdjustmentsHorizontal size={13} />
                        <span>{collectionFilter ? collections.find(c => c.dynamic_type === collectionFilter)?.name || [...categoryFilter][0] || '合集' : '合集'}</span>
                      </button>
                      {filterOpen && (
                        <div className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-2xl border border-[var(--border-primary)] overflow-hidden z-50 animate-fade-in"
                          style={{ background: 'var(--bg-secondary)' }}
                          onClick={e => e.stopPropagation()}>
                          <div className="p-2 space-y-0.5 max-h-72 overflow-y-auto">
                            <button onClick={() => { setCollectionFilter(''); setCategoryFilter(new Set()); setFilterOpen(false); }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                                !collectionFilter && categoryFilter.size === 0 ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                              }`}>
                              <span>全部单词</span>
                              <span className="text-[10px] font-mono tabular-nums opacity-60">{filterCounts['all'] ?? '…'}</span>
                            </button>
                            {collections.map(col => (
                              <button key={col.id} onClick={() => { setCollectionFilter(col.dynamic_type); setCategoryFilter(new Set()); setFilterOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                                  collectionFilter === col.dynamic_type ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                                }`}>
                                <span>{col.name}</span>
                                <span className="text-[10px] font-mono tabular-nums opacity-60">{filterCounts[`col:${col.dynamic_type}`] ?? '…'}</span>
                              </button>
                            ))}
                            {categories.map(cat => (
                              <button key={cat} onClick={() => { setCollectionFilter(''); setCategoryFilter(new Set([cat])); setFilterOpen(false); }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                                  categoryFilter.has(cat) ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                                }`}>
                                <span>📚 {cat}</span>
                                <span className="text-[10px] font-mono tabular-nums opacity-60">{filterCounts[`cat:${cat}`] ?? '…'}</span>
                              </button>
                            ))}
                          </div>
                          {(collectionFilter || categoryFilter.size > 0) && (
                            <div className="border-t border-[var(--border-secondary)] p-2">
                              <button onClick={() => { setCollectionFilter(''); setCategoryFilter(new Set()); setFilterOpen(false); }}
                                className="w-full text-xs text-center py-1.5 rounded-lg text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                                清除筛选
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {/* Search (all + mastered tabs) */}
              {(tab === 'all' || tab === 'mastered') && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary"><HiMagnifyingGlass size={13} /></span>
                  <input type="text" placeholder={tab === 'mastered' ? '搜索已掌握单词' : '搜索'} value={search} onChange={e=>setSearch(e.target.value)}
                    className="w-40 pl-8 pr-3 py-1.5 text-xs bg-[var(--bg-tertiary)] border-0 rounded-md focus:outline-none focus:ring-1 focus:ring-white/10 text-primary placeholder:text-tertiary"/>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {/* ─── Tab: 今日单词 ─── */}
          {tab === 'today' && (
            <>
              {todayStats && todayStats.total_words > 0 && (
                <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/15">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-primary">今日学习进度</p>
                      <p className="text-xs text-tertiary mt-0.5">
                        来自 {todayStats.audio_count} 个音频 · 已复习 {todayStats.reviewed_count}/{todayStats.total_words}
                      </p>
                    </div>
                    {todayUnmastered.length > 0 && (
                      <button onClick={openReview}
                        className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
                        开始今日复习 · {todayUnmastered.length} 个
                      </button>
                    )}
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
                </div>
              ) : todayWords.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-tertiary">
                  <HiSun size={32} className="opacity-30 mb-3" />
                  <p className="text-sm">今天还没听过单词</p>
                  <p className="text-xs mt-1 opacity-60">播放音频后，听过的单词会自动出现在这里</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {todayWords.map(w => (
                    <div key={w.word}
                      onClick={() => handleSelectWord({ word: w.word, count: w.audio_count })}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group ${
                        selected?.word === w.word
                          ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/30'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}>
                      <span className={`flex-1 text-sm font-medium ${knownWords.has(w.word) ? 'text-tertiary line-through decoration-tertiary/30' : 'text-primary'}`}>
                        {w.word}
                      </span>
                      <span className="text-xs text-tertiary">
                        {w.audio_count} 个音频
                      </span>
                      {knownWords.has(w.word) ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">已掌握</span>
                      ) : (
                        <button onClick={e => { e.stopPropagation(); setWordKnown(w.word, true).catch(() => {}); setKnownWords(prev => new Set(prev).add(w.word)); }}
                          className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
                          标记已掌握
                        </button>
                      )}
                      <button onClick={e=>{e.stopPropagation();favToggle({item_id:w.word,item_type:'word',title:w.word,subtitle:`${w.audio_count}个音频`});}}
                        className={`transition-colors cursor-pointer ${isFav(w.word,'word') ? 'text-[var(--accent)]' : 'text-tertiary opacity-0 group-hover:opacity-100 hover:text-tertiary'}`}>
                        <HiHeart size={11} />
                      </button>
                      {hasAiProvider && (
                        <button onClick={e=>{e.stopPropagation();handleAiLookup(w.word);}}
                          className={`transition-colors cursor-pointer opacity-0 group-hover:opacity-100 ${aiAnalysis?.word === w.word && aiExpanded ? 'text-[var(--accent)]' : 'text-tertiary hover:text-secondary'}`}
                          title="AI 分析">
                          <HiSparkles size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── Tab: 全部单词 ─── */}
          {tab === 'all' && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
                </div>
              ) : words.length === 0 ? (
                <p className="text-tertiary text-sm py-8">暂无单词</p>
              ) : (
                <>
                  <div className="space-y-0.5">
                    {words.map(w => (
                      <div key={w.word}
                        onClick={() => handleSelectWord(w)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group ${
                          selected?.word === w.word
                            ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/30'
                            : 'hover:bg-[var(--bg-hover)]'
                        }`}>
                        <span className={`flex-1 text-sm font-medium ${knownWords.has(w.word) ? 'text-tertiary' : 'text-primary'}`}>
                          {w.word}
                        </span>
                        <span className="text-xs text-tertiary tabular-nums">{w.count}次</span>
                        {knownWords.has(w.word) && (
                          <HiCheck size={12} className="text-emerald-400" />
                        )}
                        <button onClick={e=>{e.stopPropagation();favToggle({item_id:w.word,item_type:'word',title:w.word,subtitle:`${w.count}次`});}}
                          className={`transition-colors cursor-pointer ${isFav(w.word,'word') ? 'text-[var(--accent)]' : 'text-tertiary opacity-0 group-hover:opacity-100 hover:text-tertiary'}`}>
                          <HiHeart size={11} />
                        </button>
                        {hasAiProvider && (
                          <button onClick={e=>{e.stopPropagation();handleAiLookup(w.word);}}
                            className={`transition-colors cursor-pointer opacity-0 group-hover:opacity-100 ${aiAnalysis?.word === w.word && aiExpanded ? 'text-[var(--accent)]' : 'text-tertiary hover:text-secondary'}`}
                            title="AI 分析">
                            <HiSparkles size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {/* Loader trigger */}
                  <div ref={loadMoreRef} className="h-4" />
                  {loadingMore && (
                    <div className="flex justify-center py-4">
                      <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ─── Tab: 待复习 ─── */}
          {tab === 'review' && (
            <>
              {dueWordsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
                </div>
              ) : dueWords.length === 0 ? (
                <p className="text-tertiary text-sm py-8">暂无待复习单词 🎉</p>
              ) : (
                <div className="space-y-0.5">
                  {dueWords.map(d => (
                    <div key={d.word}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group">
                      <span className="flex-1 text-sm font-medium text-primary">{d.word}</span>
                      <span className="text-xs text-tertiary tabular-nums">
                        {d.last_score != null && (
                          <span className={d.last_score < 60 ? 'text-red-400' : 'text-emerald-400'}>
                            {d.last_score}%
                          </span>
                        )}
                        {d.last_score == null && '未复习'}
                      </span>
                      <button onClick={() => handleReviewWord(d.word)}
                        className="text-[10px] px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer">
                        复习
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ─── Tab: 已掌握 ─── */}
          {tab === 'mastered' && (
            <>
              {masteredLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
                </div>
              ) : masteredWords.length === 0 ? (
                <p className="text-tertiary text-sm py-8">还没有已掌握的单词</p>
              ) : (
                <div className="space-y-0.5">
                  {masteredWords.map(w => (
                    <div key={w.word}
                      onClick={() => handleSelectWord(w)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group ${
                        selected?.word === w.word
                          ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/30'
                          : 'hover:bg-[var(--bg-hover)]'
                      }`}>
                      <HiCheck size={12} className="text-emerald-400 flex-shrink-0" />
                      <span className="flex-1 text-sm text-tertiary">{w.word}</span>
                      <span className="text-xs text-tertiary tabular-nums">{w.count}次</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Slide-in detail panel */}
      {(selected || loadingDetail) && (
        <>
          <div className="md:hidden fixed inset-0 z-40 bg-black/20" onClick={() => { setSelected(null); setLoadingDetail(false); setAiExpanded(false); }} />
          <div className={`fixed z-50 bg-[var(--bg-primary)] border-[var(--border-primary)] shadow-2xl flex flex-col overflow-hidden
            md:right-0 md:top-0 md:bottom-0 md:w-96 md:border-l md:animate-fade-in
            max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:max-h-[65vh] max-md:rounded-t-2xl max-md:border-t max-md:animate-slide-up`}>
            <div className="flex-shrink-0 px-5 pt-10 pb-4 border-b border-[var(--border-secondary)]">
              {selected ? (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-3xl font-bold text-primary truncate">{selected.word}</h2>
                      <p className="text-tertiary text-xs mt-1">
                        出现 {selected.count} 次 · {selected.lessons.length} 课时
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                      {hasAiProvider && (
                        <button onClick={() => handleAiLookup(selected.word)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                            aiExpanded ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                          }`}
                          title={aiLoading ? '分析中...' : 'AI 单词分析'}>
                          {aiLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/10 border-t-[var(--accent)] rounded-full" />
                          ) : (
                            <HiSparkles size={16} />
                          )}
                        </button>
                      )}
                      <button onClick={() => toggleKnown(selected.word)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          knownWords.has(selected.word)
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-[var(--bg-tertiary)] text-tertiary hover:text-secondary'
                        }`}>
                        {knownWords.has(selected.word) ? '✓ 已掌握' : '标记掌握'}
                      </button>
                      <button onClick={() => setSelected(null)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                        <HiXMark size={16} />
                      </button>
                    </div>
                  </div>
                  {/* Stats row */}
                  <div className="flex gap-3 text-[11px]">
                    <span className="text-tertiary">
                      全部出现 <strong className="text-primary font-semibold">{selected.count}</strong> 次
                    </span>
                    <span className="text-tertiary">
                      覆盖 <strong className="text-primary font-semibold">{selected.lessons.length}</strong> 课时
                    </span>
                    {knownWords.has(selected.word) && (
                      <span className="text-emerald-400">✓ 已掌握</span>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex items-start justify-between">
                  <div>
                    <div className="h-9 w-24 rounded-lg bg-[var(--bg-tertiary)] animate-pulse mb-2" />
                    <div className="h-4 w-32 rounded bg-[var(--bg-tertiary)] animate-pulse" />
                  </div>
                </div>
              )}
            </div>

            {/* AI Analysis section */}
            {selected && aiExpanded && aiAnalysis && (
              <div className="flex-shrink-0 px-5 py-4 border-b border-[var(--border-secondary)]" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="space-y-3 text-sm">
                  {aiAnalysis.pronunciation && (
                    <p className="text-xs text-tertiary">/{aiAnalysis.pronunciation}/</p>
                  )}
                  {aiAnalysis.partOfSpeech && aiAnalysis.definition && (
                    <p>
                      <span className="text-[11px] text-tertiary italic mr-1.5">{aiAnalysis.partOfSpeech}</span>
                      <span className="text-primary">{aiAnalysis.definition}</span>
                    </p>
                  )}
                  {aiAnalysis.examples && aiAnalysis.examples.length > 0 && (
                    <div className="space-y-1.5">
                      {aiAnalysis.examples.slice(0, 2).map((ex, i) => (
                        <div key={i} className="text-xs leading-relaxed">
                          <p className="text-secondary">{ex.en}</p>
                          {ex.zh && <p className="text-tertiary">{ex.zh}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                  {aiAnalysis.synonyms && aiAnalysis.synonyms.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {aiAnalysis.synonyms.map((s, i) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-tertiary">{s}</span>
                      ))}
                    </div>
                  )}
                  {aiAnalysis.usage && (
                    <p className="text-xs text-tertiary italic">{aiAnalysis.usage}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-6 h-6 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
                </div>
              ) : selected && Object.entries(groupedOccurrences).length > 0 ? (
                Object.entries(groupedOccurrences).map(([lid, g]) => (
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
                ))
              ) : selected && (
                <p className="text-xs text-tertiary py-8 text-center">暂无出现记录</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Review Session Modal ── */}
      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget && reviewComplete) closeReview(); }}>
          <div className="w-full max-w-lg mx-4 rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden"
            style={{ background: 'var(--bg-primary)' }}>

            {reviewComplete ? (
              /* ── Summary ── */
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                  <HiSparkles size={28} className="text-emerald-400" />
                </div>
                <h2 className="text-xl font-bold text-primary mb-2">复习完成！</h2>
                <p className="text-sm text-tertiary mb-6">
                  共复习 {reviewResults.current.length} 个今日单词
                </p>
                <div className="space-y-2 mb-6">
                  {(() => {
                    const wrong = reviewResults.current.filter(r => r.score === 0).length;
                    const correct = reviewResults.current.filter(r => r.score === 100).length;
                    const pct = reviewResults.current.length > 0 ? Math.round(correct / reviewResults.current.length * 100) : 0;
                    return (
                      <>
                        <div className="flex items-center justify-between text-sm px-4 py-2 rounded-lg bg-emerald-500/5">
                          <span className="text-emerald-400">拼写正确</span>
                          <span className="text-emerald-400 font-bold tabular-nums">{correct}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm px-4 py-2 rounded-lg bg-red-500/5">
                          <span className="text-red-400">拼写错误</span>
                          <span className="text-red-400 font-bold tabular-nums">{wrong}</span>
                        </div>
                        <div className="text-center mt-4">
                          <span className="text-2xl font-black text-primary tabular-nums">{pct}%</span>
                          <p className="text-xs text-tertiary">正确率</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <button onClick={closeReview}
                  className="px-6 py-2 rounded-lg text-sm font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
                  完成
                </button>
              </div>
            ) : (
              /* ── Fill-in-the-blank ── */
              <div className="p-8">
                {/* Progress bar */}
                <div className="flex items-center justify-between mb-6">
                  <span className="text-xs text-tertiary tabular-nums">
                    {reviewIndex + 1} / {reviewQueue.length}
                  </span>
                  <div className="flex-1 mx-4 h-1 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                      style={{ width: `${(reviewIndex / reviewQueue.length) * 100}%` }} />
                  </div>
                  <button onClick={closeReview}
                    className="text-tertiary hover:text-secondary transition-colors cursor-pointer">
                    <HiXMark size={16} />
                  </button>
                </div>

                {/* Sentence context */}
                <div className="rounded-xl p-6 mb-5 min-h-[120px]" style={{ background: 'var(--bg-tertiary)' }}>
                  {reviewLoadingSentence ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full" />
                    </div>
                  ) : reviewSentence ? (
                    <div>
                      {!reviewRevealed ? (
                        /* Show sentence with blank */
                        <p className="text-sm leading-relaxed text-secondary">
                          {highlightedSentence}
                        </p>
                      ) : reviewResult === 'wrong' ? (
                        /* Show sentence with correct word highlighted */
                        <div>
                          <p className="text-sm leading-relaxed text-primary">
                            {(() => {
                              const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                              const parts = reviewSentence.sentence_text.split(new RegExp(`(\\b${escaped}\\b)`, 'gi'));
                              return parts.map((part, i) =>
                                part.toLowerCase() === cleanWord
                                  ? <span key={i} className="text-emerald-400 font-bold">{part}</span>
                                  : part
                              );
                            })()}
                          </p>
                          <p className="text-xs mt-2 text-emerald-400 font-semibold">
                            ✓ 正确答案：{reviewCorrectWord}
                          </p>
                        </div>
                      ) : (
                        /* Correct — show full sentence */
                        <p className="text-sm leading-relaxed text-primary">{reviewSentence.sentence_text}</p>
                      )}
                      <p className="text-xs text-tertiary mt-3">
                        🎧 {reviewSentence.lesson_title}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-8">
                      <p className="text-xs text-tertiary">未找到句子上下文</p>
                    </div>
                  )}
                </div>

                {/* Input area */}
                {!reviewRevealed ? (
                  <form onSubmit={e => { e.preventDefault(); if (reviewInput.trim()) handleCheckAnswer(); }}>
                    <div className="flex gap-2">
                      <input type="text" value={reviewInput} onChange={e => setReviewInput(e.target.value)}
                        placeholder="输入单词..."
                        autoFocus
                        className="flex-1 px-4 py-3 rounded-xl text-sm bg-[var(--bg-tertiary)] border-0 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 text-primary placeholder:text-tertiary" />
                      <button type="submit" disabled={!reviewInput.trim()}
                        className="px-5 py-3 rounded-xl text-sm font-semibold bg-[var(--accent)] on-accent hover:opacity-90 disabled:opacity-30 transition-opacity cursor-pointer">
                        确认
                      </button>
                    </div>
                  </form>
                ) : (
                  /* Result + Next */
                  <div className="space-y-3">
                    <div className={`p-3 rounded-xl text-sm font-medium text-center ${
                      reviewResult === 'correct'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-red-500/15 text-red-400'
                    }`}>
                      {reviewResult === 'correct' ? '✅ 拼写正确！' : `❌ 正确答案：${reviewCorrectWord}`}
                    </div>
                    <button onClick={handleNextWord}
                      className="w-full py-3 rounded-xl text-sm font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
                      {reviewIndex + 1 >= reviewQueue.length ? '查看复习结果' : '下一词 →'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
