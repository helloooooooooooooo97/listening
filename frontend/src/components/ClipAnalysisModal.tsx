import { HiSparkles } from 'react-icons/hi2';
import type { ClipAnalysis } from '../types/lesson';

interface Props {
  analysis: ClipAnalysis;
  onClose: () => void;
}

export default function ClipAnalysisModal({ analysis, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-xl rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden animate-scale-in"
        style={{ background: 'var(--bg-secondary)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className="px-5 py-4" style={{ background: 'linear-gradient(135deg, rgba(250,45,72,0.12), rgba(250,45,72,0.04))' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(250,45,72,0.15)' }}>
                <HiSparkles size={15} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-primary">片段解析</h3>
                <p className="text-[10px] text-tertiary">AI 智能分析</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer text-sm"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="px-5 py-4 max-h-[55vh] overflow-y-auto space-y-4">
          <div className="p-3.5 rounded-xl surface-card">
            <p className="text-[10px] text-tertiary font-semibold uppercase tracking-wider mb-1.5">内容总结</p>
            <p className="text-sm text-primary leading-relaxed">{analysis.summary}</p>
          </div>

          {analysis.keywords.length > 0 && (
            <div>
              <p className="text-[10px] text-tertiary font-semibold uppercase tracking-wider mb-2">关键词汇</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.keywords.map((kw, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs"
                    style={{ background: 'rgba(250,45,72,0.08)' }}
                  >
                    <span className="font-semibold text-[var(--accent)]">{kw.word}</span>
                    <span className="text-tertiary">/</span>
                    <span className="text-secondary">{kw.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1 p-3.5 rounded-xl surface-card">
              <p className="text-[10px] text-tertiary font-semibold uppercase tracking-wider mb-1.5">语法要点</p>
              <p className="text-xs text-secondary leading-relaxed">{analysis.grammar}</p>
            </div>
            <div className="flex-shrink-0 w-20 p-3.5 rounded-xl surface-card flex flex-col items-center justify-center gap-1">
              <p className="text-[10px] text-tertiary font-semibold uppercase tracking-wider">难度</p>
              <span className={`text-sm font-bold ${
                analysis.difficulty === 'easy' ? 'text-emerald-400' :
                analysis.difficulty === 'medium' ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {analysis.difficulty === 'easy' ? '简单' : analysis.difficulty === 'medium' ? '中等' : '困难'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl" style={{ background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.1)' }}>
            <div className="flex items-start gap-2">
              <span className="text-sm flex-shrink-0 mt-0.5">💡</span>
              <div>
                <p className="text-[10px] text-amber-400/70 font-semibold uppercase tracking-wider mb-1">练习建议</p>
                <p className="text-xs text-amber-200/80 leading-relaxed">{analysis.practiceTip}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
