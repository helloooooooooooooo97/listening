import { useState } from 'react';
import { HiSparkles, HiArrowPath, HiXMark, HiPlay } from 'react-icons/hi2';
import { useWordAudio } from '../../hooks/useWordAudio';

interface GameModalProps {
  isWin: boolean;
  matchedCount: number;
  totalWords: number;
  elapsed: number;
  matchedWords: string[];
  onReplay: () => void;
  onQuit: () => void;
}

export default function GameModal({ isWin, matchedCount, totalWords, elapsed, matchedWords, onReplay, onQuit }: GameModalProps) {
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const pct = totalWords > 0 ? Math.round((matchedCount / totalWords) * 100) : 0;
  const remaining = totalWords - matchedCount;
  const [showWords, setShowWords] = useState(false);
  const { playWordAudio } = useWordAudio();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden"
        style={{ background: 'var(--bg-primary)' }}>
        <div className="p-8 text-center">
          {isWin ? (
            <>
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                <HiSparkles size={28} className="text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-2">过关！</h2>
              <p className="text-sm text-tertiary mb-6">所有单词已消除</p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-4">
                <HiXMark size={24} className="text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-2">槽位满了</h2>
              <p className="text-sm text-tertiary mb-6">差一点就过关了，再来一次吧</p>
            </>
          )}

          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between text-sm px-4 py-2 rounded-lg bg-emerald-500/5">
              <span className="text-emerald-400">已消除</span>
              <span className="text-emerald-400 font-bold tabular-nums">{matchedCount}/{totalWords}</span>
            </div>
            {!isWin && remaining > 0 && (
              <div className="flex items-center justify-between text-sm px-4 py-2 rounded-lg bg-amber-500/5">
                <span className="text-amber-400">未消除</span>
                <span className="text-amber-400 font-bold tabular-nums">{remaining}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm px-4 py-2 rounded-lg bg-blue-500/5">
              <span className="text-blue-400">用时</span>
              <span className="text-blue-400 font-bold tabular-nums">{minutes}:{seconds.toString().padStart(2, '0')}</span>
            </div>
            <div className="text-center mt-3">
              <span className="text-2xl font-black text-primary tabular-nums">{pct}%</span>
              <p className="text-xs text-tertiary">消除率</p>
            </div>
            {isWin && (
              <p className="text-xs text-tertiary mt-3">
<HiSparkles size={11} className="inline mr-1" style={{ color: 'var(--accent)' }} /> 本轮复习成功 {matchedCount} 个单词
              </p>
            )}
          </div>

          {/* Toggle eliminated words list */}
          {matchedWords.length > 0 && (
            <div className="mb-4">
              <button onClick={() => setShowWords(!showWords)}
                className="text-[10px] px-3 py-1.5 rounded-lg text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                {showWords ? '收起已消除单词' : `查看已消除单词 (${matchedWords.length})`}
              </button>
              {showWords && (
                <div className="mt-3 max-h-32 overflow-y-auto space-y-0.5 px-2">
                  {matchedWords.map((w, i) => (
                    <div key={i}
                      className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors group">
                      <span className="flex-1 text-xs text-left text-secondary">{i + 1}. {w}</span>
                      <button onClick={() => playWordAudio(w)}
                        className="opacity-0 group-hover:opacity-100 text-tertiary hover:text-secondary transition-all cursor-pointer"
                        title="播放音频">
                        <HiPlay size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onQuit}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
              返回
            </button>
            <button onClick={onReplay}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-1.5">
              <HiArrowPath size={14} /> 再来一局
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
