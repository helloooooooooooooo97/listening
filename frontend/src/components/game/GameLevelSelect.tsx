import { useState } from 'react';
import { HiSun, HiArrowPath, HiBookOpen, HiSparkles, HiPlay } from 'react-icons/hi2';
import Spinner from '../ui/Spinner';
import type { Difficulty } from './levelGenerator';

interface GameLevelSelectProps {
  onStart: (difficulty: Difficulty, source: string, difficultyFilter: string) => void;
  onBack: () => void;
  onPlaySample?: (word: string) => void;
  starting?: boolean;
}

const SAMPLE_WORDS: Record<string, string> = {
  today: 'apple',
  review: 'book',
  all: 'hello',
};

const DIFF_ICONS = {
  easy: <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />,
  medium: <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />,
  hard: <span className="w-3 h-3 rounded-full bg-rose-400 inline-block" />,
};

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  today: <HiSun size={13} />,
  review: <HiArrowPath size={13} />,
  all: <HiBookOpen size={13} />,
};

export default function GameLevelSelect({ onStart, onBack, onPlaySample, starting }: GameLevelSelectProps) {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [source, setSource] = useState('today');
  const [difficultyFilter, setDifficultyFilter] = useState('');

  const difficulties: { key: Difficulty; label: string; desc: string; color: string }[] = [
    { key: 'easy', label: '简单', desc: '10 词 · 2 层 · 适合新手', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    { key: 'medium', label: '中等', desc: '15 词 · 3 层 · 有点挑战', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    { key: 'hard', label: '困难', desc: '20 词 · 4 层 · 真正考验', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  ];

  const sources: { key: string; label: string }[] = [
    { key: 'today', label: '今日单词' },
    { key: 'review', label: '待复习单词' },
    { key: 'all', label: '全部单词' },
  ];

  const wordDifficulties = [
    { key: '', label: '全部' },
    { key: 'easy', label: '简单' },
    { key: 'medium', label: '中等' },
    { key: 'hard', label: '困难' },
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold text-primary mb-2 flex items-center justify-center gap-3">
            <HiSparkles size={30} style={{ color: 'var(--accent)' }} /> 单词消除
          </h1>
          <p className="text-base text-tertiary">消除 3 个相同单词 = 复习成功</p>
        </div>

        {/* Word source */}
        <div className="mb-6">
          <p className="text-sm text-tertiary font-medium mb-3 uppercase tracking-wider">单词来源</p>
          <div className="flex gap-3">
            {sources.map(s => (
              <button key={s.key} onClick={() => setSource(s.key)}
                className={`group flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  source === s.key
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'bg-[var(--bg-tertiary)] text-tertiary hover:text-secondary'
                }`}>
                {SOURCE_ICONS[s.key]}
                {s.label}
                {onPlaySample && (
                  <span onClick={e => { e.stopPropagation(); onPlaySample(SAMPLE_WORDS[s.key]); }}
                    className="ml-1 opacity-0 group-hover:opacity-100 hover:text-secondary transition-opacity cursor-pointer"
                    title="试听">
                    <HiPlay size={10} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Word difficulty source filter */}
        <div className="mb-6">
          <p className="text-sm text-tertiary font-medium mb-3 uppercase tracking-wider">词汇难度</p>
          <div className="grid grid-cols-4 gap-2">
            {wordDifficulties.map(d => (
              <button key={d.key || 'all'} onClick={() => setDifficultyFilter(d.key)}
                className={`py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  difficultyFilter === d.key
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'bg-[var(--bg-tertiary)] text-tertiary hover:text-secondary'
                }`}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Difficulty */}
        <div className="mb-8">
          <p className="text-sm text-tertiary font-medium mb-3 uppercase tracking-wider">难度</p>
          <div className="space-y-3">
            {difficulties.map(d => (
              <button key={d.key} onClick={() => setDifficulty(d.key)}
                className={`w-full p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${
                  difficulty === d.key ? d.color + ' border-current' : 'border-[var(--border-secondary)] bg-[var(--bg-tertiary)] text-tertiary'
                }`}>
                <p className="text-base font-semibold flex items-center gap-2">{DIFF_ICONS[d.key]} {d.label}</p>
                <p className="text-sm opacity-70 mt-0.5">{d.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button onClick={onBack}
            className="flex-1 py-3.5 rounded-xl text-base font-medium text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
            返回
          </button>
          <button onClick={() => onStart(difficulty, source, difficultyFilter)}
            disabled={starting}
            className="flex-1 py-3.5 rounded-xl text-base font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
            {starting ? <Spinner size={16} /> : <HiSparkles size={16} />}
            {starting ? '加载中...' : '开始游戏'}
          </button>
        </div>
      </div>
    </div>
  );
}
