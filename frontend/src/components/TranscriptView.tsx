import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { HiBookmark, HiPlay, HiCheck, HiHeart, HiMagnifyingGlass } from 'react-icons/hi2';
import type { TranscriptLine, TranscriptWord, AudioClip } from '../types/lesson';
import { useClipsStore } from '../stores/clipsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useToastStore } from '../stores/toastStore';
import { useAudioStore, getAudio } from '../stores/audioStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getKnownWords, getDictationSentences, setWordKnown, type SentenceDictation } from '../lib/api';

interface Props {
  lessonId: string; lessonTitle: string;
  lines: TranscriptLine[]; words: TranscriptWord[];
  currentTime: number; onSeek: (t: number) => void;
  onOpenDictation?: (sentenceIdx: number) => void;
  hoveredClipId?: string | null;
  activeClipId?: string | null;
  flashSentence?: number | null;
}

interface ContextMenu {
  x: number; y: number;
  word: TranscriptWord;
}

interface WordSelection { startWord: TranscriptWord; endWord: TranscriptWord; }

export default function TranscriptView({ lessonId, lessonTitle, lines, words, currentTime, onSeek, onOpenDictation, hoveredClipId, activeClipId }: Props) {
  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addClip = useClipsStore(s => s.addClip);
  const addToast = useToastStore(s => s.addToast);

  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState<WordSelection | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<TranscriptWord | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [clipNote, setClipNote] = useState('');
  const [clipColor, setClipColor] = useState('#facc15');
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [sentenceScores, setSentenceScores] = useState<SentenceDictation[]>([]);
  const [ctxMenu, setCtxMenu] = useState<ContextMenu | null>(null);
  const [focusedSentence, setFocusedSentence] = useState<number>(-1);
  const isFav = useFavoritesStore(s => s.isFav);
  const favToggle = useFavoritesStore(s => s.toggle);
  const playClip = useAudioStore(s => s.playClip);
  const setLoopTarget = useAudioStore(s => s.setLoopTarget);
  const defaultLoopCount = useSettingsStore(s => s.settings.defaultLoopCount);

  useEffect(() => {
    getKnownWords().then(words => setKnownWords(new Set(words))).catch(() => {});
  }, []);

  useEffect(() => {
    getDictationSentences(lessonId).then(d => setSentenceScores(d.sentences)).catch(() => {});
  }, [lessonId]);

  let activeLineIndex = -1;
  for (let i=lines.length-1;i>=0;i--) { if(currentTime>=lines[i].start-0.1){activeLineIndex=i;break;} }
  let activeWordId: string|null = null;
  for (let i=words.length-1;i>=0;i--) { if(currentTime>=words[i].start&&currentTime<words[i].end){activeWordId=words[i].id;break;} }

  // Smooth scroll only when active line changes and is outside visible area
  const prevActiveRef = useRef(activeLineIndex);
  useLayoutEffect(() => {
    if (activeLineIndex === prevActiveRef.current) return;
    prevActiveRef.current = activeLineIndex;
    const el = activeLineRef.current;
    if (!el || !containerRef.current) return;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const isVisible = elRect.top >= containerRect.top + 80 && elRect.bottom <= containerRect.bottom - 80;
    if (!isVisible) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLineIndex]);

  const getWordIndex = (id: string) => words.findIndex(w=>w.id===id);

  const handleWordMouseDown = useCallback((word: TranscriptWord, e: React.MouseEvent) => {
    e.preventDefault(); setPendingAnchor(word); setIsDragging(true);
    setShowToolbar(false);
  }, []);

  const handleWordMouseEnter = useCallback((word: TranscriptWord) => {
    if(!isDragging||!pendingAnchor) return;
    const ai=getWordIndex(pendingAnchor.id), hi=getWordIndex(word.id);
    if(ai===-1||hi===-1) return;
    setSelection({startWord:words[Math.min(ai,hi)],endWord:words[Math.max(ai,hi)]});
  }, [isDragging,pendingAnchor,words]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false); setPendingAnchor(null);
    if (selection && selection.startWord.id !== selection.endWord.id) {
      setShowToolbar(true);
    } else {
      setSelection(null);
    }
  }, [selection]);

  // ── Context menu ──
  const handleWordContextMenu = useCallback((e: React.MouseEvent, word: TranscriptWord) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, word });
  }, []);

  const closeContextMenu = useCallback(() => setCtxMenu(null), []);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', close, true);
    };
  }, [ctxMenu]);

  // ── Double-click to toggle known ──
  const handleWordDoubleClick = useCallback((word: TranscriptWord) => {
    const text = word.text.toLowerCase();
    const known = knownWords.has(text);
    setKnownWords(prev => {
      const next = new Set(prev);
      if (known) next.delete(text); else next.add(text);
      return next;
    });
    setWordKnown(text, !known).catch(() => {});
  }, [knownWords]);

  // ── Keyboard navigation ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (ctxMenu) {
        if (e.key === 'Escape') setCtxMenu(null);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedSentence(prev => {
          const next = Math.min(lines.length - 1, prev + 1);
          const el = document.querySelector(`[data-sentence-idx="${next}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedSentence(prev => {
          const next = Math.max(0, prev - 1);
          const el = document.querySelector(`[data-sentence-idx="${next}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return next;
        });
      } else if (e.key === 'Enter' && focusedSentence >= 0) {
        e.preventDefault();
        onSeek(lines[focusedSentence].start);
      } else if (e.key === 'Escape') {
        setFocusedSentence(-1);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [lines, focusedSentence, ctxMenu, onSeek]);

  // ── Clear selection on outside click ──
  useEffect(() => {
    const onClick=(e:MouseEvent)=>{
      const target = e.target as HTMLElement;
      if (target.closest('.clip-toolbar') || target.closest('.ctx-menu')) return;
      setSelection(null); setShowToolbar(false); setClipNote('');
    };
    document.addEventListener('mousedown',onClick); return ()=>document.removeEventListener('mousedown',onClick);
  }, []);

  const handleSaveClip = () => {
    if(!selection) return;
    const si=getWordIndex(selection.startWord.id), ei=getWordIndex(selection.endWord.id);
    if(si===-1||ei===-1) return;
    const sw=words.slice(si,ei+1);
    addClip({lessonId,lessonTitle,startWordId:selection.startWord.id,endWordId:selection.endWord.id,startTime:selection.startWord.start,endTime:selection.endWord.end,text:sw.map(w=>w.text).join(' '),note:clipNote.trim(),color:clipColor});
    addToast('片段已保存','success');
    setSelection(null); setShowToolbar(false); setClipNote(''); setClipColor('#facc15');
  };

  const handleCancelSelection = () => { setSelection(null); setShowToolbar(false); setClipNote(''); };

  // Build sentence lookup for dictation data
  const sentenceDictMap = useMemo(() => {
    const m = new Map<number, SentenceDictation>();
    for (const s of sentenceScores) m.set(s.index, s);
    return m;
  }, [sentenceScores]);

  // Build wrong indices lookup: sentenceIndex → Set<wordIndex>
  const wrongIdxMap = useMemo(() => {
    const m = new Map<number, Set<number>>();
    for (const sd of sentenceScores) {
      m.set(sd.index, new Set(sd.wrong_indices));
    }
    return m;
  }, [sentenceScores]);

  // Clips data for this lesson
  const allClips = useClipsStore(s => s.clips);
  const lessonClips = useMemo(() => allClips.filter(c => c.lessonId === lessonId), [allClips, lessonId]);
  const wordClipInfo = (wordStart: number, wordEnd: number) => {
    const covering = lessonClips.filter(c => wordStart >= c.startTime - 0.1 && wordEnd <= c.endTime + 0.1);
    return { count: covering.length, color: covering[0]?.color || '#facc15' };
  };

  const isWordSelected = (id: string) => {
    if(!selection) return false;
    const si=getWordIndex(selection.startWord.id), ei=getWordIndex(selection.endWord.id), wi=getWordIndex(id);
    return wi>=si&&wi<=ei;
  };

  // Get current lesson context from audioStore (keeps expanded overlay alive)
  const audioMode = useAudioStore(s => s.mode);
  const contextLesson = audioMode.kind === 'lesson' ? audioMode.lesson :
    audioMode.kind === 'clip' ? audioMode.lesson : null;

  // Play a saved clip from its single anchor button.
  const handlePlayLineClip = (e: React.MouseEvent, clip: AudioClip) => {
    e.stopPropagation();
    const lineClip: AudioClip = {
      id: clip.id,
      lessonId,
      lessonTitle,
      startTime: clip.startTime,
      endTime: clip.endTime,
      text: clip.text,
      note: clip.note,
      startWordId: clip.startWordId,
      endWordId: clip.endWordId,
      createdAt: clip.createdAt,
      color: clip.color || '#facc15',
    };
    setLoopTarget(defaultLoopCount);
    playClip(lineClip, contextLesson);
  };

  // Anchor each clip to exactly one word, so the play button appears once per clip.
  const clipByAnchorWordId = useMemo(() => {
    const m = new Map<string, AudioClip>();
    for (const clip of lessonClips) {
      const byStoredId = clip.startWordId
        ? words.find(w => w.id === clip.startWordId)
        : undefined;
      const byTime = words.reduce<TranscriptWord | null>((best, word) => {
        const distance = Math.abs(word.start - clip.startTime);
        if (distance > 0.35) return best;
        if (!best || distance < Math.abs(best.start - clip.startTime)) return word;
        return best;
      }, null);
      const anchor = byStoredId ?? byTime;
      if (anchor && !m.has(anchor.id)) m.set(anchor.id, clip);
    }
    return m;
  }, [lessonClips, words]);

  return (
    <div ref={containerRef} className="relative">
      {showToolbar && selection && (() => {
        const endEl = containerRef.current?.querySelector(`[data-word-id="${selection.endWord.id}"]`);
        const rect = endEl?.getBoundingClientRect();
        return (
          <div className="clip-toolbar fixed z-50 animate-fade-in"
            style={{
              left: rect ? Math.max(10, Math.min(rect.left, window.innerWidth - 280)) : 100,
              top: rect ? rect.bottom + 6 : 100,
            }}>
            <div className="rounded-lg px-3 py-2 shadow-2xl flex items-center gap-2" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
              <HiBookmark size={13} className="flex-shrink-0" style={{ color: clipColor }} />
              <span className="text-xs text-secondary truncate max-w-[80px]">{selection.startWord.text}...{selection.endWord.text}</span>
              {/* Color circles */}
              <div className="flex items-center gap-1">
                {['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7'].map(c => (
                  <button key={c} onClick={e => { e.stopPropagation(); setClipColor(c); }}
                    className="w-4 h-4 rounded-full border-2 transition-transform cursor-pointer hover:scale-125"
                    style={{
                      backgroundColor: c,
                      borderColor: clipColor === c ? 'var(--text-primary)' : 'transparent',
                    }} />
                ))}
              </div>
              <span className="text-tertiary">|</span>
              <input type="text" placeholder="备注..." value={clipNote}
                onChange={e => setClipNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveClip(); if (e.key === 'Escape') handleCancelSelection(); }}
                className="w-20 text-xs text-secondary bg-transparent border-0 outline-none placeholder:text-tertiary" />
              <button onClick={handleSaveClip} className="px-2 py-0.5 text-xs font-medium bg-[var(--accent)] on-accent rounded-md hover:bg-[var(--accent-hover)] transition-colors cursor-pointer whitespace-nowrap">保存</button>
              <button onClick={handleCancelSelection} className="text-tertiary hover:text-secondary transition-colors cursor-pointer text-xs">✕</button>
            </div>
          </div>
        );
      })()}

      <div className="space-y-1" onMouseUp={handleMouseUp}>
        {lines.map((line, lineIdx) => {
          const isActive = lineIdx===activeLineIndex;
          const lineWords = words.filter(w=>w.start>=line.start-0.05&&w.end<=line.end+0.05);
          const sentData = sentenceDictMap.get(lineIdx);
          return (
            <div key={line.id} ref={isActive?activeLineRef:null}
              data-sentence-idx={lineIdx}
              className={`transcript-line ${isActive?'active':''} ${focusedSentence===lineIdx?'ring-1 ring-[var(--accent)]/30 rounded-lg':''} flex items-start gap-4 px-4 py-2.5`}
              onClick={()=>onSeek(line.start)}>
              {/* Line number + timestamp */}
              <div className="flex-shrink-0 flex items-center gap-2 pt-0.5 text-sm font-mono text-tertiary select-none">
                <span className="w-5 text-right text-tertiary">{lineIdx + 1}</span>
                <span className="w-12 text-left text-tertiary">{Math.floor(line.start/60)}:{Math.floor(line.start%60).toString().padStart(2,'0')}</span>
              </div>
              {/* Words */}
              <p className="flex-1 text-base leading-relaxed text-secondary select-none">
                {lineWords.length>0
                  ? lineWords.map((word, wordIdx) => {
                      const sel=isWordSelected(word.id);
                      const ci = wordClipInfo(word.start, word.end);
                      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
                      let clipAlpha = Math.min((isLight ? 0.12 : 0.06) * ci.count, isLight ? 0.3 : 0.2);
                      // Boost opacity for hovered/active clip
                      const boostedClip = lessonClips.find(c =>
                        c.id === hoveredClipId || c.id === activeClipId
                      );
                      if (boostedClip && word.start >= boostedClip.startTime - 0.1 && word.end <= boostedClip.endTime + 0.1) {
                        clipAlpha = Math.max(clipAlpha, isLight ? 0.28 : 0.22);
                      }
                      const isKnown = knownWords.has(word.text.toLowerCase());
                      const isFavorited = isFav(word.text.toLowerCase(), 'word');
                      const isWrong = wrongIdxMap.get(lineIdx)?.has(wordIdx) ?? false;
                      const anchoredClip = clipByAnchorWordId.get(word.id);
                      const hexToRgb = (hex: string) => {
                        const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
                        return m ? `${parseInt(m[1],16)},${parseInt(m[2],16)},${parseInt(m[3],16)}` : '250,204,21';
                      };
                      const clipRgb = hexToRgb(ci.color);
                      return (
                        <span key={word.id} data-word-id={word.id}
                          onMouseDown={e=>handleWordMouseDown(word,e)}
                          onMouseEnter={()=>handleWordMouseEnter(word)}
                          onClick={e => { e.stopPropagation(); if (!selection) onSeek(word.start); }}
                          onContextMenu={e => handleWordContextMenu(e, word)}
                          onDoubleClick={() => handleWordDoubleClick(word)}
                          className={`transcript-word cursor-pointer ${
                            word.id===activeWordId&&!selection ? 'active' : sel ? 'selected' : 'hover:bg-[var(--bg-hover)]'
                          }`}
                          style={{
                            ...(ci.count > 0 ? { background: `rgba(${clipRgb},${clipAlpha})`, borderRadius: 0 } : {}),
                            ...(isKnown ? { color: isLight ? 'rgb(16,185,129)' : 'rgba(52,211,153,0.75)' } : {}),
                            ...(isWrong ? { textDecoration: 'underline wavy rgba(239,68,68,0.6)', textUnderlineOffset: '2px' } : ci.count > 0 ? { borderBottom: `1px solid rgba(${clipRgb},0.4)` } : {}),
                          }}>
                          {/* Clip play button at the start of each clip */}
                          {anchoredClip && (
                            <button onClick={e => handlePlayLineClip(e, anchoredClip)}
                              className="inline-flex items-center justify-center w-4 h-4 rounded bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 hover:text-amber-700 transition-colors cursor-pointer align-middle mr-1 -mt-0.5"
                              title="播放片段">
                              <HiPlay size={8} />
                            </button>
                          )}
                          {isFavorited && <span className="text-[var(--accent)] text-[9px] mr-px">♥</span>}
                          {word.text}{' '}
                        </span>
                      );
                    })
                  : line.text}
                {/* Sentence score badge */}
                {sentData && sentData.count > 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); onOpenDictation?.(lineIdx); }}
                    className={`inline-flex items-center ml-2 text-[11px] font-mono px-1.5 py-0.5 rounded cursor-pointer transition-colors hover:scale-105 ${
                      sentData.avg_score >= 80 ? 'text-emerald-500/70 bg-emerald-500/15 hover:bg-emerald-500/25' :
                      sentData.avg_score >= 50 ? 'text-amber-500/70 bg-amber-500/15 hover:bg-amber-500/25' :
                      'text-red-500/70 bg-red-500/10 hover:bg-red-500/20'
                    }`}
                    title={`听写 ${sentData.count} 次 · 均分 ${sentData.avg_score}% · 最近 ${sentData.last_score}% · 点击查看详情`}>
                    {sentData.avg_score}%
                  </button>
                )}
              </p>
              {line.note && <p className="text-xs text-tertiary mt-1 italic">{line.note}</p>}
            </div>
          );
        })}
      </div>

      {/* Context Menu */}
      {ctxMenu && (
        <div className="ctx-menu fixed z-[100] rounded-xl shadow-2xl border border-[var(--border-primary)] overflow-hidden animate-scale-in"
          style={{
            left: Math.min(ctxMenu.x, window.innerWidth - 200),
            top: Math.min(ctxMenu.y, window.innerHeight - 220),
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}>
          <button onClick={() => {
            const a = getAudio();
            const savedCurrent = a.currentTime;
            a.currentTime = ctxMenu.word.start;
            if (a.paused) { a.play(); setTimeout(() => { a.pause(); a.currentTime = savedCurrent; }, 800); }
            else { setTimeout(() => { a.currentTime = savedCurrent; }, 800); }
            closeContextMenu();
          }} className="w-full text-left px-4 py-2.5 text-xs text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center gap-2">
            <HiPlay size={12} className="text-tertiary"/> 播放此词
          </button>
          <button onClick={() => {
            handleWordDoubleClick(ctxMenu.word);
            closeContextMenu();
          }} className={`w-full text-left px-4 py-2.5 text-xs transition-colors cursor-pointer flex items-center gap-2 ${
            knownWords.has(ctxMenu.word.text.toLowerCase()) ? 'text-emerald-400 hover:bg-[var(--bg-hover)]' : 'text-secondary hover:bg-[var(--bg-hover)]'
          }`}>
            <HiCheck size={12} className={knownWords.has(ctxMenu.word.text.toLowerCase()) ? 'text-emerald-400' : 'text-tertiary'} />
            {knownWords.has(ctxMenu.word.text.toLowerCase()) ? '取消掌握' : '标记掌握'}
          </button>
          <button onClick={() => {
            favToggle({ item_id: ctxMenu.word.text.toLowerCase(), item_type: 'word', title: ctxMenu.word.text, subtitle: '' });
            closeContextMenu();
          }} className={`w-full text-left px-4 py-2.5 text-xs transition-colors cursor-pointer flex items-center gap-2 ${
            isFav(ctxMenu.word.text.toLowerCase(), 'word') ? 'text-[var(--accent)] hover:bg-[var(--bg-hover)]' : 'text-secondary hover:bg-[var(--bg-hover)]'
          }`}>
            <HiHeart size={12} className={isFav(ctxMenu.word.text.toLowerCase(), 'word') ? 'text-[var(--accent)]' : 'text-tertiary'} />
            {isFav(ctxMenu.word.text.toLowerCase(), 'word') ? '取消收藏' : '收藏单词'}
          </button>
          <button onClick={() => {
            window.open(`https://dictionary.cambridge.org/dictionary/english/${encodeURIComponent(ctxMenu.word.text.toLowerCase())}`, '_blank');
            closeContextMenu();
          }} className="w-full text-left px-4 py-2.5 text-xs text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer flex items-center gap-2">
            <HiMagnifyingGlass size={12} className="text-tertiary"/> 查词典
          </button>
        </div>
      )}
    </div>
  );
}
