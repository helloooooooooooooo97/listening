import { useEffect, useRef, useState } from 'react';
import { HiCheck, HiXMark, HiPlay, HiArrowRight, HiArrowLeft, HiForward, HiChevronDown } from 'react-icons/hi2';
import { useAudioStore } from '../stores/audioStore';
import { useDictationStore } from '../stores/dictationStore';

export default function DictationView() {
  const mode = useAudioStore(s => s.mode);
  const seek = useAudioStore(s => s.seek);
  const isPlaying = useAudioStore(s => s.isPlaying);
  const currentTime = useAudioStore(s => s.currentTime);
  const inputRef = useRef<HTMLInputElement>(null);

  const active = useDictationStore(s => s.active);
  const sentenceIndex = useDictationStore(s => s.sentenceIndex);
  const userInput = useDictationStore(s => s.userInput);
  const results = useDictationStore(s => s.results);
  const scores = useDictationStore(s => s.scores);
  const phase = useDictationStore(s => s.phase);
  const setInput = useDictationStore(s => s.setInput);
  const submit = useDictationStore(s => s.submit);
  const nextSentence = useDictationStore(s => s.nextSentence);
  const prevSentence = useDictationStore(s => s.prevSentence);
  const goToSentence = useDictationStore(s => s.goToSentence);
  const skip = useDictationStore(s => s.skip);
  const reset = useDictationStore(s => s.reset);

  if (!active || mode.kind !== 'lesson') return null;

  const sentences = mode.lesson.transcript;
  const currentSentence = sentences[sentenceIndex];
  if (!currentSentence) {
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0) / scores.length) : 0;
    return (
      <div className="h-full flex items-center justify-center bg-[#0a0a0b]">
        <div className="text-center animate-scale-in px-8">
          <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: `linear-gradient(135deg, #fa2d48, #c0392b)` }}>
            <span className="text-3xl font-bold text-white">{avgScore}%</span>
          </div>
          <h2 className="text-2xl font-bold text-white">听写完成！</h2>
          <p className="text-white/40 mt-2">{scores.length} 个句子 · 平均正确率 {avgScore}%</p>
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {scores.map((s,i)=>(
              <span key={i} className={`px-2 py-1 rounded-md text-xs font-mono ${s>=80?'bg-emerald-500/20 text-emerald-400':s>=50?'bg-amber-500/20 text-amber-400':'bg-red-500/20 text-red-400'}`}>
                句{i+1}: {s}%
              </span>
            ))}
          </div>
          <button onClick={reset} className="mt-6 px-5 py-2 bg-white/[0.08] text-white/70 rounded-full text-sm hover:bg-white/[0.12] transition-colors cursor-pointer">关闭听写</button>
        </div>
      </div>
    );
  }

  const sentenceWords = mode.lesson.words.filter(w => w.start >= currentSentence.start - 0.05 && w.end <= currentSentence.end + 0.05);
  const expectedWords = sentenceWords.map(w => w.text);

  const handlePlaySentence = () => {
    seek(currentSentence.start);
    setTimeout(() => useAudioStore.getState().togglePlay(), 150);
  };

  const handleSubmit = () => {
    if (userInput.trim()) {
      submit(expectedWords);
      // Track dictation to backend
      const sentenceText = currentSentence.text;
      const expectedJoined = expectedWords.join(' ');
      setTimeout(() => {
        const state = useDictationStore.getState();
        const latestScore = state.scores[state.scores.length-1] || 0;
        fetch('/api/progress/dictation', {
          method: 'POST', headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            audio_id: mode.lesson!.id, audio_title: mode.lesson!.title,
            sentence_index: sentenceIndex, score: latestScore,
            user_input: userInput.trim(),
            expected_text: expectedJoined,
          }),
        }).catch(()=>{});
      }, 100);
    }
  };

  const [showSelector, setShowSelector] = useState(false);

  // Auto-play once when entering a new sentence
  useEffect(() => {
    seek(currentSentence.start);
    setTimeout(() => useAudioStore.getState().togglePlay(), 150);
  }, [sentenceIndex]);

  // Stop when sentence ends
  useEffect(() => {
    if (!isPlaying || !currentSentence) return;
    if (currentTime >= currentSentence.end - 0.1) {
      useAudioStore.getState().togglePlay();
    }
  }, [currentTime, isPlaying, currentSentence]);

  // Auto-focus input
  useEffect(() => {
    if (phase === 'typing') inputRef.current?.focus();
  }, [phase]);

  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a,b)=>a+b,0) / scores.length) : null;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0b] overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 flex items-center justify-between border-b border-white/[0.04]">
        <div>
          <h2 className="text-lg font-bold text-white">听写模式</h2>
          {/* Sentence selector */}
          <div className="relative mt-1">
            <button
              onClick={() => setShowSelector(!showSelector)}
              className="flex items-center gap-1.5 text-white/35 hover:text-white/60 transition-colors cursor-pointer text-xs"
            >
              第 {sentenceIndex + 1}/{sentences.length} 句
              <HiChevronDown size={10} className={`transition-transform ${showSelector ? 'rotate-180' : ''}`} />
              {avgScore !== null && <span className="text-white/15">· 均分 {avgScore}%</span>}
            </button>
            {showSelector && (
              <div className="absolute top-full left-0 mt-1 w-72 max-h-64 overflow-y-auto bg-[#1a1a1d] border border-white/[0.08] rounded-xl shadow-2xl z-50 py-1 animate-scale-in">
                {sentences.map((s, i) => {
                  const done = scores[i] !== undefined;
                  const sScore = scores[i];
                  return (
                    <button
                      key={i}
                      onClick={() => { goToSentence(i); setShowSelector(false); }}
                      className={`w-full text-left px-4 py-2 text-xs flex items-center gap-3 transition-colors cursor-pointer ${
                        i === sentenceIndex
                          ? 'bg-[#fa2d48]/10 text-white'
                          : 'text-white/40 hover:bg-white/[0.04] hover:text-white/70'
                      }`}
                    >
                      <span className={`w-6 h-5 rounded flex items-center justify-center text-[10px] font-mono flex-shrink-0 ${
                        done
                          ? sScore! >= 80 ? 'bg-emerald-500/20 text-emerald-400' : sScore! >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                          : 'bg-white/[0.04] text-white/20'
                      }`}>
                        {done ? `${sScore}%` : i + 1}
                      </span>
                      <span className="truncate">{s.text.slice(0, 50)}{s.text.length > 50 ? '...' : ''}</span>
                      {done && sScore! < 50 && <span className="ml-auto text-[10px] text-red-400/50">需复习</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Sentence nav arrows */}
          <button
            onClick={prevSentence}
            disabled={sentenceIndex <= 0}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-20 disabled:cursor-default transition-colors cursor-pointer text-white/40 hover:text-white/70"
            title="上一句"
          >
            <HiArrowLeft size={14} />
          </button>
          <button
            onClick={nextSentence}
            disabled={sentenceIndex >= sentences.length - 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-20 disabled:cursor-default transition-colors cursor-pointer text-white/40 hover:text-white/70"
            title="下一句"
          >
            <HiArrowRight size={14} />
          </button>
          <button onClick={reset} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer rounded-lg hover:bg-white/[0.04]">退出</button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-lg space-y-6">
          {/* Phase: Typing — play once, then show input */}
          {phase === 'typing' && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3 mb-4">
                <button onClick={handlePlaySentence} className="w-10 h-10 rounded-full flex items-center justify-center bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer flex-shrink-0">
                  <HiPlay size={16} className="text-white/50"/>
                </button>
                <p className="text-white/30 text-sm">点击播放后输入你听到的内容</p>
              </div>
              <input ref={inputRef} type="text" value={userInput}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder="输入你听到的内容..."
                className="w-full px-4 py-3 text-lg bg-white/[0.04] border border-white/[0.06] rounded-xl text-white placeholder:text-white/15 focus:outline-none focus:ring-2 focus:ring-[#fa2d48]/30"/>
              <div className="mt-3 flex gap-2">
                <button onClick={handleSubmit}
                  disabled={!userInput.trim()}
                  className="flex-1 py-2.5 bg-[#fa2d48] hover:bg-[#fb5b6e] disabled:bg-white/[0.04] disabled:text-white/15 text-white font-semibold rounded-full text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                  提交 <HiArrowRight size={14}/>
                </button>
                <button onClick={() => skip()}
                  className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-white/30 hover:text-white/50 rounded-full text-sm transition-colors cursor-pointer flex items-center gap-1"
                  title="跳过此句（记0分）">
                  <HiForward size={14}/> 跳过
                </button>
              </div>
            </div>
          )}

          {/* Phase: Feedback */}
          {phase === 'feedback' && (
            <div className="animate-scale-in">
              <div className="text-center mb-4">
                <span className="text-3xl font-bold text-white">{scores[scores.length-1]}%</span>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center mb-6">
                {results.map((r, i) => (
                  <span key={i} className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-sm font-medium transition-all animate-scale-in ${
                    r.status === 'correct' ? 'bg-emerald-500/20 text-emerald-400' :
                    r.status === 'wrong' ? 'bg-red-500/20 text-red-400 line-through' :
                    r.status === 'missing' ? 'bg-red-500/10 text-red-300/50' :
                    'bg-amber-500/20 text-amber-400 line-through'
                  }`} style={{animationDelay:`${i*30}ms`}}>
                    {r.status === 'correct' && <HiCheck size={12}/>}
                    {r.status === 'wrong' && <HiXMark size={12}/>}
                    {(r.status === 'correct' || r.status === 'wrong') && r.expected}
                    {r.status === 'missing' && <span className="italic">{r.expected}</span>}
                    {r.status === 'extra' && <span>{r.actual}</span>}
                  </span>
                ))}
              </div>
              <div className="flex gap-3 justify-center flex-wrap">
                <button onClick={prevSentence}
                  disabled={sentenceIndex <= 0}
                  className="px-4 py-2 bg-white/[0.04] text-white/40 rounded-full text-sm hover:bg-white/[0.08] disabled:opacity-20 disabled:cursor-default transition-colors cursor-pointer flex items-center gap-1.5">
                  <HiArrowLeft size={14}/> 上一句
                </button>
                <button onClick={handlePlaySentence}
                  className="px-4 py-2 bg-white/[0.04] text-white/60 rounded-full text-sm hover:bg-white/[0.08] transition-colors cursor-pointer flex items-center gap-1.5">
                  <HiPlay size={14}/> 重听
                </button>
                <button onClick={nextSentence}
                  className="px-4 py-2 bg-[#fa2d48] text-white rounded-full text-sm font-semibold hover:bg-[#fb5b6e] transition-colors cursor-pointer flex items-center gap-1.5">
                  下一句 <HiArrowRight size={14}/>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
