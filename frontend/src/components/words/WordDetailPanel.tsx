import { useRef, useCallback } from 'react';
import { HiPlay, HiSparkles, HiXMark } from 'react-icons/hi2';
import type { WordDetail, WordDictionary } from '../../lib/api';
import type { WordAnalysis } from '../../types/lesson';
function _fmtTime(s: number) { const m = Math.floor(s / 60); return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`; }

// TagBadge colors
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

interface WordDetailPanelProps {
  selected: WordDetail | null;
  loadingDetail: boolean;
  dictionary: WordDictionary | null;
  loadingDict: boolean;
  knownWords: Set<string>;
  aiAnalysis: WordAnalysis | null;
  aiLoading: boolean;
  aiExpanded: boolean;
  hasAiProvider: boolean;
  onClose: () => void;
  onToggleKnown: (word: string) => void;
  onAiLookup: (word: string) => void;
  onPlayAt: (lessonId: string, lessonTitle: string, word: string, time: number) => void;
}

export default function WordDetailPanel({
  selected, loadingDetail, dictionary, loadingDict,
  knownWords, aiAnalysis, aiLoading, aiExpanded, hasAiProvider,
  onClose, onToggleKnown, onAiLookup, onPlayAt,
}: WordDetailPanelProps) {
  if (!selected && !loadingDetail) return null;

  const groupedOccurrences = selected
    ? selected.lessons.reduce((acc, l) => ({
      ...acc,
      [l.id]: { title: l.title, times: l.occurrences },
    }), {} as Record<string, { title: string; times: number[] }>)
    : {};

  // ── Scroll to currently playing occurrence ──
  const lastPlayedRef = useRef<number | null>(null);
  const playRef = useCallback((lid: string, title: string, word: string, time: number) => {
    lastPlayedRef.current = time;
    onPlayAt(lid, title, word, time);
    // Use RAF to let the DOM update before scrolling
    requestAnimationFrame(() => {
      const btn = document.querySelector(`[data-play-occ="${lid}-${time}"]`);
      btn?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [onPlayAt]);

  return (
    <>
      {/* Mobile overlay */}
      <div className="md:hidden fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      <div className={`fixed z-50 bg-[var(--bg-primary)] border-[var(--border-primary)] shadow-2xl flex flex-col overflow-hidden
        md:right-0 md:top-0 md:bottom-0 md:w-96 md:border-l md:animate-fade-in
        max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:max-h-[65vh] max-md:rounded-t-2xl max-md:border-t max-md:animate-slide-up`}>

        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-10 pb-4 border-b border-[var(--border-secondary)]">
          {selected ? (
            <>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-3xl font-bold text-primary truncate">{selected.word}</h2>

                  {/* Dictionary entry */}
                  {loadingDict ? (
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-4 w-32 rounded bg-[var(--bg-tertiary)] animate-pulse" />
                    </div>
                  ) : dictionary ? (
                    <div className="mt-1.5 space-y-0.5">
                      {dictionary.tags.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          {dictionary.tags.map(t => <TagBadge key={t} tag={t} />)}
                        </div>
                      )}
                      {dictionary.pronunciation && (
                        <p className="text-xs text-tertiary font-mono">/{dictionary.pronunciation}/</p>
                      )}
                      {(dictionary.partOfSpeech || dictionary.definition) && (
                        <p className="text-xs text-secondary">
                          {dictionary.partOfSpeech && <span className="italic mr-1">{dictionary.partOfSpeech}</span>}
                          {dictionary.definition}
                        </p>
                      )}
                    </div>
                  ) : null}

                  <p className="text-tertiary text-xs mt-2">
                    出现 {selected.count} 次 · {selected.lessons.length} 课时
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                  {hasAiProvider && (
                    <button onClick={() => onAiLookup(selected.word)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        aiExpanded ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                      }`}
                      title={aiLoading ? '分析中...' : 'AI 单词分析'}>
                      {aiLoading ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/10 border-t-[var(--accent)] rounded-full animate-spin" />
                      ) : (
                        <HiSparkles size={16} />
                      )}
                    </button>
                  )}
                  <button onClick={() => onToggleKnown(selected.word)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      knownWords.has(selected.word)
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-[var(--bg-tertiary)] text-tertiary hover:text-secondary'
                    }`}>
                    {knownWords.has(selected.word) ? '✓ 已掌握' : '标记掌握'}
                  </button>
                  <button onClick={onClose}
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

        {/* Occurrences list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
            </div>
          ) : Object.entries(groupedOccurrences).length > 0 ? (
            Object.entries(groupedOccurrences).map(([lid, g]) => (
              <div key={lid}>
                <p className="text-xs font-bold text-tertiary uppercase tracking-[0.15em] mb-2">{g.title}</p>
                <div className="flex flex-wrap gap-1.5">
                  {g.times.map((t, i) => {
                    const isPlaying = lastPlayedRef.current === t;
                    return (
                      <button key={i}
                        data-play-occ={`${lid}-${t}`}
                        onClick={() => playRef(lid, g.title, selected!.word, t)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors cursor-pointer font-mono ${
                          isPlaying
                            ? 'bg-[var(--accent)]/20 text-[var(--accent)] ring-1 ring-[var(--accent)]/30'
                            : 'text-secondary hover:text-white hover:bg-[var(--bg-hover)]'
                        }`}
                        title={`播放 ${_fmtTime(t)}`}>
                        <HiPlay size={10} className={isPlaying ? 'text-[var(--accent)]' : 'text-tertiary'} />
                        {_fmtTime(t)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-tertiary py-8 text-center">暂无出现记录</p>
          )}
        </div>
      </div>
    </>
  );
}

