import { useState, useEffect } from 'react';
import { HiMusicalNote, HiBookmark, HiPlay, HiBookOpen } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { useClipsStore } from '../stores/clipsStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useToastStore } from '../stores/toastStore';

function fmtTime(s: number) { const m=Math.floor(s/60); return `${m}:${Math.floor(s%60).toString().padStart(2,'0')}`; }

export default function PlayerPanel() {
  const mode = useAudioStore(s => s.mode);
  const currentTime = useAudioStore(s => s.currentTime);
  const seek = useAudioStore(s => s.seek);
  const isPlaying = useAudioStore(s => s.isPlaying);
  const updateClip = useClipsStore(s => s.updateClip);
  const addClip = useClipsStore(s => s.addClip);
  const addToast = useToastStore(s => s.addToast);
  const getPosition = useSettingsStore(s => s.getPosition);
  const clearPosition = useSettingsStore(s => s.clearPosition);

  const [showRestore, setShowRestore] = useState(false);
  const [savedPos, setSavedPos] = useState<number | null>(null);

  useEffect(() => {
    if (mode.kind === 'lesson') {
      const mem = getPosition(mode.lesson.id);
      if (mem && mem.position > 1) { setSavedPos(mem.position); setShowRestore(true); }
      else setShowRestore(false);
    } else setShowRestore(false);
  }, [mode.kind==='lesson'?mode.lesson?.id:null, getPosition]);

  // Find active sentence for tracklist highlight
  let activeSentenceIdx = -1;
  if (mode.kind === 'lesson') {
    for (let i=mode.lesson.transcript.length-1;i>=0;i--) {
      if (currentTime >= mode.lesson.transcript[i].start - 0.1) { activeSentenceIdx=i; break; }
    }
  }

  if (mode.kind === 'empty') {
    return (
      <div className="flex items-center justify-center h-full bg-[#0a0a0b]">
        <div className="text-center animate-fade-in">
          <div className="w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg, #fa2d48, #ff6b7f)' }}>
            <HiMusicalNote size={36} />
          </div>
          <p className="text-white/80 text-xl font-bold tracking-tight">欢迎使用听力练习</p>
          <p className="text-white/30 text-sm mt-2">从左侧选择音频</p>
          <p className="text-white/15 text-xs mt-6">点击底部播放栏可展开歌词</p>
        </div>
      </div>
    );
  }

  if (mode.kind === 'lesson') {
    const { lesson } = mode;
    const lines = lesson.transcript;
    return (
      <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
        {/* Album Header */}
        <div className="flex-shrink-0 px-8 pt-10 pb-6" style={{ background: 'linear-gradient(180deg, #1a0a14 0%, #0d0d10 60%, #0a0a0b 100%)' }}>
          <div className="flex items-end gap-6">
            <div className="w-36 h-36 md:w-44 md:h-44 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xl"
              style={{ background: 'linear-gradient(135deg, #fa2d48 0%, #c0392b 50%, #6b1d2a 100%)', boxShadow: '0 20px 60px rgba(250,45,72,0.3)' }}>
              <HiMusicalNote size={56} />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2">音频</p>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-tight">{lesson.title}</h1>
              <p className="text-sm text-white/40 mt-1.5">{lesson.subtitle}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.06] text-white/40">{lesson.level}</span>
                <span className="text-[12px] text-white/30">{lines.length} 个句子 · {lesson.words.length} 个单词</span>
              </div>
            </div>
          </div>
        </div>

        {/* Restore prompt */}
        {showRestore && savedPos && (
          <div className="flex-shrink-0 mx-8 mb-2 flex items-center gap-3 px-4 py-2.5 rounded-xl animate-fade-in"
            style={{ background: 'rgba(250,45,72,0.06)', border: '1px solid rgba(250,45,72,0.1)' }}>
            <span className="text-[12px] text-white/60">上次播放到 {fmtTime(savedPos)}</span>
            <div className="flex-1"/>
            <button onClick={()=>{seek(savedPos);setShowRestore(false);}}
              className="text-[11px] font-semibold px-3 py-1 bg-[#fa2d48] text-white rounded-full hover:bg-[#fb5b6e] transition-colors cursor-pointer">跳转</button>
            <button onClick={()=>{clearPosition(lesson.id);setShowRestore(false);}}
              className="text-[11px] text-white/30 hover:text-white/60 cursor-pointer">忽略</button>
          </div>
        )}

        {/* Tracklist */}
        <div className="flex-1 overflow-y-auto">
          <div className="sticky top-0 z-10 flex items-center gap-4 px-8 py-2 text-[10px] font-semibold text-white/20 uppercase tracking-wider border-b border-white/[0.04] bg-[#0a0a0b]/90 backdrop-blur">
            <span className="w-6 text-center">#</span>
            <span className="flex-1">句子</span>
            <span className="w-16 text-right">时长</span>
          </div>

          <div className="px-4 py-2">
            {lines.map((line, i) => {
              const isActive = i === activeSentenceIdx;
              const dur = line.end - line.start;
              const lineWords = lesson.words.filter(w => w.start >= line.start - 0.05 && w.end <= line.end + 0.05);
              return (
                <div key={line.id}
                  onClick={() => seek(line.start)}
                  className={`group flex items-center gap-4 px-4 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
                    isActive ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                  }`}>
                  <div className="relative w-6 flex-shrink-0 text-center">
                    <span className={`text-[12px] tabular-nums ${isActive ? 'hidden' : 'text-white/15 group-hover:hidden'}`}>{i + 1}</span>
                    <span className={`absolute inset-0 flex items-center justify-center ${isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {isActive && isPlaying
                        ? <span className="w-1 h-3 rounded-full bg-[#fa2d48] animate-pulse"/>
                        : <HiPlay size={10}/>}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-[13px] leading-relaxed ${isActive ? 'text-white/90 font-medium' : 'text-white/50'}`}>
                      {lineWords.length > 0 ? lineWords.map(w => {
                        const wordActive = isActive && currentTime >= w.start && currentTime < w.end;
                        return (
                          <span key={w.id} className={`inline rounded-sm px-[1px] transition-colors duration-100 ${wordActive ? 'bg-[#fa2d48] text-white' : ''}`}>
                            {w.text}{' '}
                          </span>
                        );
                      }) : line.text}
                    </p>
                    {line.note && <p className="text-[11px] text-white/20 mt-0.5">{line.note}</p>}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-white/20 tabular-nums w-10 text-right">{dur.toFixed(1)}s</span>
                    <button onClick={e => {
                      e.stopPropagation();
                      const ws = lesson.words.filter(w => w.start >= line.start - 0.05 && w.end <= line.end + 0.05);
                      if (ws.length > 0) {
                        addClip({ lessonId: lesson.id, lessonTitle: lesson.title, startWordId: ws[0].id, endWordId: ws[ws.length-1].id, startTime: line.start, endTime: line.end, text: ws.map(w => w.text).join(' '), note: '' });
                        addToast('已保存句子为片段', 'success');
                      }
                    }} className="text-white/10 hover:text-[#fa2d48] transition-colors opacity-0 group-hover:opacity-100 cursor-pointer" title="保存句子">
                      <HiBookmark size={13}/>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-8 pb-8 text-center text-[10px] text-white/15 space-y-0.5">
            {lesson.sourceURL && <p><a href={lesson.sourceURL} target="_blank" rel="noopener noreferrer" className="hover:text-white/40 transition-colors">{lesson.sourceURL}</a></p>}
            {lesson.textSourceURL && <p><a href={lesson.textSourceURL} target="_blank" rel="noopener noreferrer" className="hover:text-white/40 transition-colors">{lesson.textSourceURL}</a></p>}
          </div>
        </div>
      </div>
    );
  }

  // ── Clip Mode ──
  const { clip, lesson } = mode;
  const cs = clip.startTime, ce = clip.endTime;
  return (
    <div className="h-full flex flex-col bg-[#0a0a0b]">
      <div className="flex-shrink-0 px-8 pt-10 pb-8" style={{ background: 'linear-gradient(180deg, #0a1a14 0%, #0d0d10 100%)' }}>
        <div className="flex items-end gap-6">
          <div className="w-36 h-36 md:w-44 md:h-44 rounded-xl flex items-center justify-center flex-shrink-0 shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 20px 60px rgba(16,185,129,0.3)' }}>
            <HiBookmark size={56} />
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-2">片段复习</p>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight leading-tight line-clamp-2">"{clip.text}"</h1>
            <p className="text-sm text-white/40 mt-2">{clip.lessonTitle} · {cs.toFixed(1)}s – {ce.toFixed(1)}s</p>
            {clip.note && <span className="inline-block mt-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.06] text-white/50">{clip.note}</span>}
            <input type="text" placeholder="添加标签..." defaultValue={clip.note}
              onBlur={e=>{if(e.target.value.trim()!==clip.note)updateClip(clip.id,{note:e.target.value.trim()});}}
              onKeyDown={e=>{if(e.key==='Enter'){updateClip(clip.id,{note:(e.target as HTMLInputElement).value.trim()});(e.target as HTMLInputElement).blur();}}}
              className="block mt-2 w-full text-xs text-white/30 border-none bg-transparent focus:outline-none focus:text-white/60 placeholder:text-white/15"/>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-6">
          {lesson && (
            <div className="rounded-xl p-5" style={{ background:'rgba(255,255,255,0.02)' }}>
              <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.15em] mb-3 flex items-center gap-1.5"><HiBookOpen size={12}/>上下文</p>
              {lesson.transcript.filter(l=>l.end>=cs-1&&l.start<=ce+1).map(l=>(
                <p key={l.id} className="text-[13px] text-white/45 leading-relaxed mb-1.5">{l.text}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
