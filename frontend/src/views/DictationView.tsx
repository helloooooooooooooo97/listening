import { useEffect, useRef } from 'react';
import { HiCheck, HiXMark, HiPlay, HiArrowRight } from 'react-icons/hi2';
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
    if (userInput.trim()) submit(expectedWords);
  };

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
          <p className="text-white/25 text-xs mt-0.5">
            第 {sentenceIndex + 1}/{sentences.length} 句
            {avgScore !== null && <span className="ml-2">· 均分 {avgScore}%</span>}
          </p>
        </div>
        <button onClick={reset} className="px-3 py-1.5 text-xs text-white/40 hover:text-white/70 transition-colors cursor-pointer rounded-lg hover:bg-white/[0.04]">退出</button>
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
              <button onClick={handleSubmit}
                disabled={!userInput.trim()}
                className="mt-3 w-full py-2.5 bg-[#fa2d48] hover:bg-[#fb5b6e] disabled:bg-white/[0.04] disabled:text-white/15 text-white font-semibold rounded-full text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5">
                提交 <HiArrowRight size={14}/>
              </button>
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
              <div className="flex gap-3 justify-center">
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
