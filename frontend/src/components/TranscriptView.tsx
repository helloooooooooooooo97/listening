import { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { HiBookmark, HiPlay } from 'react-icons/hi2';
import type { TranscriptLine, TranscriptWord, AudioClip } from '../types/lesson';
import { useClipsStore } from '../stores/clipsStore';
import { useFavoritesStore } from '../stores/favoritesStore';
import { useToastStore } from '../stores/toastStore';
import { useAudioStore } from '../stores/audioStore';
import { useSettingsStore } from '../stores/settingsStore';
import { getKnownWords, getDictationSentences, type SentenceDictation } from '../lib/api';

interface Props {
  lessonId: string; lessonTitle: string;
  lines: TranscriptLine[]; words: TranscriptWord[];
  currentTime: number; onSeek: (t: number) => void;
  onOpenDictation?: (sentenceIdx: number) => void;
}

interface WordSelection { startWord: TranscriptWord; endWord: TranscriptWord; }

export default function TranscriptView({ lessonId, lessonTitle, lines, words, currentTime, onSeek, onOpenDictation }: Props) {
  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addClip = useClipsStore(s => s.addClip);
  const addToast = useToastStore(s => s.addToast);

  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState<WordSelection | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<TranscriptWord | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [clipNote, setClipNote] = useState('');
  const [knownWords, setKnownWords] = useState<Set<string>>(new Set());
  const [sentenceScores, setSentenceScores] = useState<SentenceDictation[]>([]);
  const isFav = useFavoritesStore(s => s.isFav);
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

  useEffect(() => {
    const onClick=(e:MouseEvent)=>{
      const target = e.target as HTMLElement;
      if (target.closest('.clip-toolbar')) return;
      setSelection(null); setShowToolbar(false); setClipNote('');
    };
    document.addEventListener('mousedown',onClick); return ()=>document.removeEventListener('mousedown',onClick);
  }, []);

  const handleSaveClip = () => {
    if(!selection) return;
    const si=getWordIndex(selection.startWord.id), ei=getWordIndex(selection.endWord.id);
    if(si===-1||ei===-1) return;
    const sw=words.slice(si,ei+1);
    addClip({lessonId,lessonTitle,startWordId:selection.startWord.id,endWordId:selection.endWord.id,startTime:selection.startWord.start,endTime:selection.endWord.end,text:sw.map(w=>w.text).join(' '),note:clipNote.trim()});
    addToast('片段已保存','success');
    setSelection(null); setShowToolbar(false); setClipNote('');
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
  const wordClipCount = (wordStart: number, wordEnd: number) =>
    lessonClips.filter(c => wordStart >= c.startTime - 0.1 && wordEnd <= c.endTime + 0.1).length;

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
              <HiBookmark size={13} className="text-[var(--accent)] flex-shrink-0" />
              <span className="text-xs text-secondary truncate max-w-[100px]">{selection.startWord.text}...{selection.endWord.text}</span>
              <span className="text-tertiary">|</span>
              <input type="text" placeholder="添加备注..." value={clipNote}
                onChange={e => setClipNote(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveClip(); if (e.key === 'Escape') handleCancelSelection(); }}
                className="w-28 text-xs text-secondary bg-transparent border-0 outline-none placeholder:text-tertiary" />
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
              className={`transcript-line ${isActive?'active':''} flex items-start gap-4 px-4 py-2.5`}
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
                      const cc = wordClipCount(word.start, word.end);
                      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
                      const clipAlpha = Math.min((isLight ? 0.12 : 0.06) * cc, isLight ? 0.3 : 0.2);
                      const isKnown = knownWords.has(word.text.toLowerCase());
                      const isFavorited = isFav(word.text.toLowerCase(), 'word');
                      const isWrong = wrongIdxMap.get(lineIdx)?.has(wordIdx) ?? false;
                      // Show the clip play button only once, on the clip's anchor word.
                      const anchoredClip = clipByAnchorWordId.get(word.id);
                      return (
                        <span key={word.id} data-word-id={word.id}
                          onMouseDown={e=>handleWordMouseDown(word,e)}
                          onMouseEnter={()=>handleWordMouseEnter(word)}
                          onClick={e => { e.stopPropagation(); if (!selection) onSeek(word.start); }}
                          className={`transcript-word cursor-pointer ${
                            word.id===activeWordId&&!selection ? 'active' : sel ? 'selected' : 'hover:bg-[var(--bg-hover)]'
                          }`}
                          style={{
                            ...(cc > 0 ? { background: `rgba(250,204,21,${clipAlpha})`, borderRadius: 0 } : {}),
                            ...(isKnown ? { color: isLight ? 'rgb(16,185,129)' : 'rgba(52,211,153,0.75)' } : {}),
                            ...(isWrong ? { textDecoration: 'underline wavy rgba(239,68,68,0.6)', textUnderlineOffset: '2px' } : cc > 0 ? { borderBottom: '1px solid rgba(250,204,21,0.4)' } : {}),
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
    </div>
  );
}
