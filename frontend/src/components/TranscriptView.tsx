import { useCallback, useEffect, useRef, useState } from 'react';
import { HiBookmark } from 'react-icons/hi2';
import type { TranscriptLine, TranscriptWord } from '../types/lesson';
import { useClipsStore } from '../stores/clipsStore';
import { useToastStore } from '../stores/toastStore';

interface Props {
  lessonId: string; lessonTitle: string;
  lines: TranscriptLine[]; words: TranscriptWord[];
  currentTime: number; onSeek: (t: number) => void;
}

interface WordSelection { startWord: TranscriptWord; endWord: TranscriptWord; }

export default function TranscriptView({ lessonId, lessonTitle, lines, words, currentTime, onSeek }: Props) {
  const activeLineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const addClip = useClipsStore(s => s.addClip);
  const addToast = useToastStore(s => s.addToast);

  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState<WordSelection | null>(null);
  const [pendingAnchor, setPendingAnchor] = useState<TranscriptWord | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [clipNote, setClipNote] = useState('');

  let activeLineIndex = -1;
  for (let i=lines.length-1;i>=0;i--) { if(currentTime>=lines[i].start-0.1){activeLineIndex=i;break;} }
  let activeWordId: string|null = null;
  for (let i=words.length-1;i>=0;i--) { if(currentTime>=words[i].start&&currentTime<words[i].end){activeWordId=words[i].id;break;} }

  useEffect(() => { if(activeLineRef.current) activeLineRef.current.scrollIntoView({behavior:'smooth',block:'center'}); }, [activeLineIndex]);

  const getWordIndex = (id: string) => words.findIndex(w=>w.id===id);

  const handleWordMouseDown = useCallback((word: TranscriptWord, e: React.MouseEvent) => {
    e.preventDefault(); setPendingAnchor(word); setIsDragging(true);
    setSelection({startWord:word,endWord:word}); setShowToolbar(false);
  }, []);

  const handleWordMouseEnter = useCallback((word: TranscriptWord) => {
    if(!isDragging||!pendingAnchor) return;
    const ai=getWordIndex(pendingAnchor.id), hi=getWordIndex(word.id);
    if(ai===-1||hi===-1) return;
    setSelection({startWord:words[Math.min(ai,hi)],endWord:words[Math.max(ai,hi)]});
  }, [isDragging,pendingAnchor,words]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false); setPendingAnchor(null);
    if(selection && selection.startWord.id!==selection.endWord.id) setShowToolbar(true);
  }, [selection]);

  useEffect(() => {
    const onClick=(e:MouseEvent)=>{if(containerRef.current&&!containerRef.current.contains(e.target as Node)){setSelection(null);setShowToolbar(false);setClipNote('');}};
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
  const isWordSelected = (id: string) => {
    if(!selection) return false;
    const si=getWordIndex(selection.startWord.id), ei=getWordIndex(selection.endWord.id), wi=getWordIndex(id);
    return wi>=si&&wi<=ei;
  };

  return (
    <div ref={containerRef} className="relative">
      {showToolbar && selection && (
        <div className="sticky top-0 z-20 rounded-2xl p-5 mb-4 animate-scale-in" style={{ background: 'rgba(250,45,72,0.1)', border: '1px solid rgba(250,45,72,0.2)' }}>
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/90 flex items-center gap-1.5"><HiBookmark size={14}/>保存片段</p>
              <p className="text-[13px] text-white/50 italic mt-1 truncate">"{selection.startWord.text} ... {selection.endWord.text}"</p>
              <input type="text" placeholder="添加标签..." value={clipNote}
                onChange={e=>setClipNote(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter')handleSaveClip();if(e.key==='Escape')handleCancelSelection();}}
                className="mt-3 w-full text-[13px] text-white/70 bg-white/[0.06] rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#fa2d48]/30 placeholder:text-white/20"/>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <button onClick={handleSaveClip} className="px-4 py-2 text-[13px] font-semibold bg-[#fa2d48] text-white rounded-full hover:bg-[#fb5b6e] transition-colors cursor-pointer">保存</button>
              <button onClick={handleCancelSelection} className="px-4 py-2 text-[13px] text-white/40 hover:text-white/70 transition-colors cursor-pointer">取消</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-1" onMouseUp={handleMouseUp}>
        <p className="text-[10px] font-semibold text-white/20 uppercase tracking-widest mb-3 px-1">文本 · 拖拽选词保存片段</p>
        {lines.map((line, lineIdx) => {
          const isActive = lineIdx===activeLineIndex;
          const lineWords = words.filter(w=>w.start>=line.start-0.05&&w.end<=line.end+0.05);
          return (
            <div key={line.id} ref={isActive?activeLineRef:null}
              className={`transcript-line ${isActive?'active':''}`}
              onClick={()=>onSeek(line.start)}>
              <p className="text-sm leading-relaxed text-white/60 select-none">
                {lineWords.length>0
                  ? lineWords.map(word=>{
                      const sel=isWordSelected(word.id);
                      return (
                        <span key={word.id} data-word-id={word.id}
                          onMouseDown={e=>handleWordMouseDown(word,e)}
                          onMouseEnter={()=>handleWordMouseEnter(word)}
                          className={`transcript-word cursor-pointer ${
                            word.id===activeWordId&&!selection ? 'active' : sel ? 'selected' : 'hover:bg-white/[0.06]'
                          }`}>
                          {word.text}{' '}
                        </span>
                      );
                    })
                  : line.text}
              </p>
              {line.note && <p className="text-xs text-white/20 mt-1 italic">{line.note}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
