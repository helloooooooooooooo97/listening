import { useEffect } from 'react';
import { HiPlay, HiArrowRight } from 'react-icons/hi2';

interface Props {
  inputRef: React.RefObject<HTMLInputElement | null>;
  userInput: string;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onSkip?: () => void;
  onPlaySentence: () => void;
}

export default function TypingPhase({ inputRef, userInput, onInputChange, onSubmit, onSkip, onPlaySentence }: Props) {
  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <div className="animate-fade-in w-full flex flex-col items-center gap-4">
      <div className="w-full max-w-2xl">
        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); }}
          placeholder="输入你听到的内容..."
          size={Math.max(24, userInput.length + 2)}
          className="w-full px-6 py-4 text-2xl text-center bg-transparent border-2 border-[var(--border-primary)] rounded-2xl text-primary placeholder:text-tertiary focus:outline-none focus:border-[#fa2d48]/50 focus:ring-2 focus:ring-[#fa2d48]/10 transition-all"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className="flex items-center gap-3">
        <button onClick={onPlaySentence}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-active)] transition-colors cursor-pointer text-secondary text-sm">
          <HiPlay size={16} /> 播放
        </button>
        <button onClick={onSubmit}
          disabled={!userInput.trim()}
          className="flex items-center gap-1.5 px-8 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-tertiary)] disabled:text-tertiary on-accent font-semibold rounded-full text-sm transition-colors cursor-pointer">
          提交 <HiArrowRight size={14} />
        </button>
        {onSkip && (
          <button onClick={onSkip}
            className="px-5 py-2.5 rounded-full bg-[var(--bg-tertiary)] hover:bg-[var(--bg-active)] transition-colors cursor-pointer text-secondary text-sm">
            跳过
          </button>
        )}
      </div>
    </div>
  );
}
