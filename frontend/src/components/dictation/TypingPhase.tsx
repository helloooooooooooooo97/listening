import { useRef, useEffect } from 'react';
import { HiPlay, HiArrowRight, HiForward } from 'react-icons/hi2';

interface Props {
  inputRef: React.RefObject<HTMLInputElement | null>;
  userInput: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onSkip: () => void;
  onPlaySentence: () => void;
}

export default function TypingPhase({ inputRef, userInput, onInputChange, onSubmit, onSkip, onPlaySentence }: Props) {
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onPlaySentence} className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--bg-tertiary)] hover:bg-[var(--bg-active)] transition-colors cursor-pointer flex-shrink-0">
          <HiPlay size={16} className="text-secondary" />
        </button>
        <p className="text-tertiary text-sm">点击播放后输入你听到的内容</p>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={userInput}
        onChange={e => onInputChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
        placeholder="输入你听到的内容..."
        className="w-full px-4 py-3 text-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-xl text-primary placeholder:text-tertiary focus:outline-none focus:ring-2 focus:ring-[#fa2d48]/30"
      />
      <div className="mt-3 flex gap-2">
        <button onClick={onSubmit}
          disabled={!userInput.trim()}
          className="flex-1 py-2.5 bg-[#fa2d48] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-tertiary text-primary font-semibold rounded-full text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5">
          提交 <HiArrowRight size={14} />
        </button>
        <button onClick={onSkip}
          className="px-4 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-active)] text-tertiary hover:text-secondary rounded-full text-sm transition-colors cursor-pointer flex items-center gap-1"
          title="跳过此句（记0分）">
          <HiForward size={14} /> 跳过
        </button>
      </div>
    </div>
  );
}
