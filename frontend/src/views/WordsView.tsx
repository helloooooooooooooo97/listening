import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiMagnifyingGlass, HiCheck, HiBarsArrowDown, HiHeart, HiSun, HiArrowPath, HiSparkles, HiBookOpen, HiPlay } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useAiStore } from '../stores/aiStore';
import type { WordAnalysis } from '../types/lesson';
import { getWords, getWordDetail, getKnownWords, setWordKnown, getDueWords, submitWordReview, getTodayWords, getTodayStats, getDictionaryEntry, type WordSummary, type WordDetail, type WordDictionary, type DueWord, type TodayWord, type TodayStats } from '../lib/api';
import { useWordAudio } from '../hooks/useWordAudio';
import ReviewModal from '../components/words/ReviewModal';
import FilterDrawer from '../components/words/FilterDrawer';
import WordDetailPanel from '../components/words/WordDetailPanel';

// ── Tag Badge ──
const TAG_STYLES: Record<string, string> = {
  'CET-4': 'bg-blue-500/15 text-blue-400',
  'CET-6': 'bg-emerald-500/15 text-emerald-400',
  'TEM-4': 'bg-purple-500/15 text-purple-400',
  'TEM-8': 'bg-red-500/15 text-red-400',
  'IELTS': 'bg-orange-500/15 text-orange-400',
  'TOEFL': 'bg-pink-500/15 text-pink-400',
};

function TagBadge({ tag }: { tag: string }) {
  const s = TAG_STYLES[tag] || 'bg-gray-500/15 text-gray-400';
  return (
    <span className={`text-[9px] px-1 py-0.5 rounded ${s} font-medium whitespace-nowrap`}>
      {tag}
    </span>
  );
}

// ── Shared tab content wrapper ──

function TabContent({ loading, empty, emptyMessage, children }: { loading: boolean; empty: boolean; emptyMessage: string; children: React.ReactNode }) {
  if (loading) return <div className="flex items-center justify-center py-16"><div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" /></div>;
  if (empty) return <p className="text-tertiary text-sm py-8 text-center">{emptyMessage}</p>;
  return <div className="space-y-0.5">{children}</div>;
}

// ── Shared word row ──

interface WordRowData {
  word: string;
  count: number;
  tags?: string[];
}

function WordRow({ item, selected, known, tags, isFavWord, hasAi, aiExpanded, aiWord, onSelect, onFav, onMarkKnown, onAi, onPlayWord }: {
  item: WordRowData; selected: boolean; known: boolean; tags?: string[]; isFavWord: boolean;
  hasAi: boolean; aiExpanded: boolean; aiWord: string | undefined;
  onSelect: () => void; onFav: () => void; onMarkKnown?: () => void; onAi?: () => void;
  onPlayWord?: () => void;
}) {
  return (
    <div data-word={item.word} onClick={onSelect}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 cursor-pointer group ${
        selected ? 'bg-[var(--accent)]/15 ring-1 ring-[var(--accent)]/30' : 'hover:bg-[var(--bg-hover)]'
      }`}>
      <span className={`flex-1 text-sm font-medium ${known ? 'text-tertiary' : 'text-primary'} flex items-center gap-1.5`}>
        {item.word}
        {tags && tags.length > 0 && (
          <span className="flex items-center gap-0.5">{tags.map(t => <TagBadge key={t} tag={t} />)}</span>
        )}
      </span>
      <span className="text-xs text-tertiary tabular-nums">{item.count}次</span>
      {onPlayWord && (
        <button onClick={e => { e.stopPropagation(); onPlayWord(); }}
          className="transition-colors cursor-pointer text-tertiary opacity-0 group-hover:opacity-100 hover:text-secondary"
          title="播放音频">
          <HiPlay size={11} />
        </button>
      )}
      {known && !onMarkKnown && <HiCheck size={12} className="text-emerald-400" />}
      {onMarkKnown ? (
        known ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">已掌握</span>
        ) : (
          <button onClick={e => { e.stopPropagation(); onMarkKnown(); }}
            className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-tertiary)] text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer opacity-0 group-hover:opacity-100">
            标记已掌握
          </button>
        )
      ) : null}
      <button onClick={e => { e.stopPropagation(); onFav(); }}
        className={`transition-colors cursor-pointer ${isFavWord ? 'text-[var(--accent)]' : 'text-tertiary opacity-0 group-hover:opacity-100 hover:text-tertiary'}`}>
        <HiHeart size={11} />
      </button>
      {hasAi && (
        <button onClick={e => { e.stopPropagation(); onAi?.(); }}
          className={`transition-colors cursor-pointer opacity-0 group-hover:opacity-100 ${aiExpanded && aiWord === item.word ? 'text-[var(--accent)]' : 'text-tertiary hover:text-secondary'}`}
          title="AI 分析">
          <HiSparkles size={12} />
        </button>
      )}
    </div>
  );
}

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
  const [examFilter, setExamFilter] = useState<string>('');
  const [dueWords, setDueWords] = useState<DueWord[]>([]);
  const [masteredWords, setMasteredWords] = useState<WordSummary[]>([]);
  const [masteredLoading, setMasteredLoading] = useState(false);
  const [dueWordsLoading, setDueWordsLoading] = useState(false);
  const favToggle = useFavoritesStore(s => s.toggle);
  const isFav = useFavoritesStore(s => s.isFav);
  const [selected, setSelected] = useState<WordDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [dictionary, setDictionary] = useState<WordDictionary | null>(null);
  const [loadingDict, setLoadingDict] = useState(false);
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [aiAnalysis, setAiAnalysis] = useState<WordAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const lookupWord = useAiStore(s => s.lookupWord);
  const hasAiProvider = useAiStore(s => s.providers.length > 0);
  const navigate = useNavigate();

  // Review modal state
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewWords, setReviewWords] = useState<{ word: string; source?: string }[]>([]);

  // Load known words from API
  useEffect(() => {
    getKnownWords()
      .then(words => setKnownWords(new Set(words)))
      .catch(() => {});
  }, []);
  const viewClip = useAudioStore(s => s.viewClip);
  const togglePlay = useAudioStore(s => s.togglePlay);
  const wordOffset = useSettingsStore(s => s.settings.wordPlayOffset);
  const { playWordAudio } = useWordAudio();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const detailCache = useRef(new Map<string, WordDetail>());
  const listRef = useRef<HTMLDivElement | null>(null);

  // Scroll the selected word row into view when detail panel opens
  useEffect(() => {
    if (selected && listRef.current) {
      // Wait for the layout shift (detail panel slide-in transition, 300ms)
      const timer = setTimeout(() => {
        listRef.current?.querySelector(`[data-word="${selected.word}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [selected]);

  // Load today's words + stats
  const loadTodayData = useCallback(() => {
    getTodayWords().then(d => {
      setTodayWords(d.words);
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
  const loadWords = useCallback((query: string, sm: SortMode, off: number, append: boolean, cat?: string, coll?: string, exam?: string) => {
    if (off === 0) setLoading(true);
    else setLoadingMore(true);
    const order = sm === 'freq-asc' ? 'asc' : 'desc';
    getWords({ sort: 'freq', order, limit: PAGE_SIZE, offset: off, q: query || undefined, category: cat, collection: coll, exam: exam || undefined })
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
      loadWords(search, sortMode, 0, false, cat, coll, examFilter || undefined);
    }
  }, [tab, sortMode, categoryFilter, collectionFilter, examFilter]);

  // Search — only debounce on actual search input change (tab/filter changes handled by the load effect above)
  useEffect(() => {
    if (tab !== 'all') return;
    const timer = setTimeout(() => {
      setOffset(0);
      const cat = [...categoryFilter][0] || undefined;
      const coll = collectionFilter || undefined;
      loadWords(search, sortMode, 0, false, cat, coll, examFilter || undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

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
        loadWords(search, sortMode, newOff, true, [...categoryFilter][0] || undefined, collectionFilter || undefined, examFilter || undefined);
      }
    }, { rootMargin: '200px' });
    observerRef.current.observe(node);
  }, [loadWords, search, sortMode, categoryFilter, collectionFilter, examFilter]);

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
    setDictionary(null);
    if (detailCache.current.has(w.word)) {
      setSelected(detailCache.current.get(w.word)!);
    } else {
      setLoadingDetail(true);
      getWordDetail(w.word)
        .then(detail => {
          detailCache.current.set(w.word, detail);
          setSelected(detail);
        })
        .catch(() => {})
        .finally(() => setLoadingDetail(false));
    }
    setLoadingDict(true);
    getDictionaryEntry(w.word)
      .then(setDictionary)
      .catch(() => {})
      .finally(() => setLoadingDict(false));
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

  const openReview = useCallback(() => {
    const unmastered = todayWords.filter(w => !knownWords.has(w.word));
    if (unmastered.length === 0) return;
    setReviewWords(unmastered.map(w => ({ word: w.word, source: '今日单词' })));
    setReviewOpen(true);
  }, [todayWords, knownWords]);

  const openReviewFromDueWords = (due: DueWord[]) => {
    setReviewWords(due.map(d => ({ word: d.word, source: '待复习' })));
    setReviewOpen(true);
  };

  const onReviewComplete = () => {
    // Refresh due words and today words after review
    getDueWords(200)
      .then(data => setDueWords(data.words))
      .catch(() => {});
    getTodayWords().then(d => setTodayWords(d.words)).catch(() => {});
    getTodayStats().then(setTodayStats).catch(() => {});
    getKnownWords()
      .then(words => setKnownWords(new Set(words)))
      .catch(() => {});
  };

  // Count today's unmastered words
  const todayUnmastered = todayWords.filter(w => !knownWords.has(w.word));

  const handleFilterChange = (filters: { collectionFilter: string; categoryFilter: Set<string>; examFilter: string }) => {
    setCollectionFilter(filters.collectionFilter);
    setCategoryFilter(filters.categoryFilter);
    setExamFilter(filters.examFilter);
  };

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
                  {/* Filter drawer */}
                  <FilterDrawer
                    collectionFilter={collectionFilter}
                    categoryFilter={categoryFilter}
                    examFilter={examFilter}
                    onChange={handleFilterChange}
                  />
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

        <div ref={listRef} className="flex-1 overflow-y-auto px-6 pb-8">
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
                    <div className="flex items-center gap-2">
                      {todayUnmastered.length > 0 && (
                        <button onClick={openReview}
                          className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
                          开始今日复习 · {todayUnmastered.length} 个
                        </button>
                      )}
                      <button onClick={() => navigate('/game')}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer">
                        <HiSparkles size={14} className="text-amber-400 flex-shrink-0" /> 游戏
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <TabContent loading={loading} empty={todayWords.length === 0} emptyMessage="">
                {todayWords.length === 0 && !loading ? (
                  <div className="flex flex-col items-center justify-center py-20 text-tertiary">
                    <HiSun size={32} className="opacity-30 mb-3" />
                    <p className="text-sm">今天还没听过单词</p>
                    <p className="text-xs mt-1 opacity-60">播放音频后，听过的单词会自动出现在这里</p>
                  </div>
                ) : todayWords.map(w => (
                  <WordRow key={w.word}
                    item={{ word: w.word, count: w.audio_count }}
                    selected={selected?.word === w.word}
                    known={knownWords.has(w.word)}
                    isFavWord={isFav(w.word, 'word')}
                    hasAi={hasAiProvider}
                    aiExpanded={aiExpanded}
                    aiWord={aiAnalysis?.word}
                    onSelect={() => handleSelectWord({ word: w.word, count: w.audio_count })}
                    onFav={() => favToggle({ item_id: w.word, item_type: 'word', title: w.word, subtitle: `${w.audio_count}个音频` })}
                    onMarkKnown={() => { setWordKnown(w.word, true).catch(() => {}); setKnownWords(prev => new Set(prev).add(w.word)); }}
                    onAi={() => handleAiLookup(w.word)}
                  />
                ))}
              </TabContent>
            </>
          )}

          {/* ─── Tab: 全部单词 ─── */}
          {tab === 'all' && (
            <>
              <TabContent loading={loading} empty={words.length === 0} emptyMessage="暂无单词">
                {words.map(w => (
                  <WordRow key={w.word}
                    item={w}
                    selected={selected?.word === w.word}
                    known={knownWords.has(w.word)}
                    isFavWord={isFav(w.word, 'word')}
                    hasAi={hasAiProvider}
                    aiExpanded={aiExpanded}
                    aiWord={aiAnalysis?.word}
                    tags={w.tags}
                    onSelect={() => handleSelectWord(w)}
                    onFav={() => favToggle({ item_id: w.word, item_type: 'word', title: w.word, subtitle: `${w.count}次` })}
                    onAi={() => handleAiLookup(w.word)}
                  />
                ))}
                {/* Loader trigger */}
                <div ref={loadMoreRef} className="h-4" />
                {loadingMore && (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
                  </div>
                )}
              </TabContent>
            </>
          )}

          {/* ─── Tab: 待复习 ─── */}
          {tab === 'review' && (
            <>
              {dueWordsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
                </div>
              ) : dueWords.length === 0 ? (
                <p className="text-tertiary text-sm py-8">暂无待复习单词 🎉</p>
              ) : (
                <>
                  {/* All-review button */}
                  {dueWords.length > 0 && (
                    <div className="mb-3 flex justify-end gap-2">
                      <button onClick={() => navigate('/game')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition-colors cursor-pointer">
                        <HiSparkles size={14} className="text-amber-400 flex-shrink-0" /> 游戏模式
                      </button>
                      <button onClick={() => openReviewFromDueWords(dueWords)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer">
                        全部复习 ({dueWords.length})
                      </button>
                    </div>
                  )}
                  <div className="space-y-0.5">
                    {dueWords.map(d => (
                      <div key={d.word}
                        data-word={d.word}
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
                        <button onClick={() => openReviewFromDueWords([d])}
                          className="text-[10px] px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors cursor-pointer">
                          复习
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {/* ─── Tab: 已掌握 ─── */}
          {tab === 'mastered' && (
            <TabContent loading={masteredLoading} empty={masteredWords.length === 0} emptyMessage="还没有已掌握的单词">
              {masteredWords.map(w => (
                <WordRow key={w.word}
                  item={w}
                  selected={selected?.word === w.word}
                  known={true}
                  isFavWord={false}
                  hasAi={false}
                  aiExpanded={false}
                  aiWord={undefined}
                  onSelect={() => handleSelectWord(w)}
                  onFav={() => {}}
                  onPlayWord={() => playWordAudio(w.word)}
                />
              ))}
            </TabContent>
          )}
        </div>
      </div>

      {/* Slide-in detail panel */}
      <WordDetailPanel
        selected={selected}
        loadingDetail={loadingDetail}
        dictionary={dictionary}
        loadingDict={loadingDict}
        knownWords={knownWords}
        aiAnalysis={aiAnalysis}
        aiLoading={aiLoading}
        aiExpanded={aiExpanded}
        hasAiProvider={hasAiProvider}
        onClose={() => { setSelected(null); setLoadingDetail(false); setAiExpanded(false); }}
        onToggleKnown={toggleKnown}
        onAiLookup={handleAiLookup}
        onPlayAt={handlePlayAt}
      />

      {/* Review Session Modal */}
      <ReviewModal
        open={reviewOpen}
        onClose={() => { setReviewOpen(false); onReviewComplete(); }}
        words={reviewWords}
        mode="fill-in"
        onComplete={() => onReviewComplete()}
      />
    </div>
  );
}
