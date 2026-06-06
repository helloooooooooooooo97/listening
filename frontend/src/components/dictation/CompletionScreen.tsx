interface Props {
  scores: number[];
  onReset: () => void;
}

export default function CompletionScreen({ scores, onReset }: Props) {
  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return (
    <div className="h-full flex items-center justify-center bg-[#0a0a0b]">
      <div className="text-center animate-scale-in px-8">
        <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: 'linear-gradient(135deg, #fa2d48, #c0392b)' }}>
          <span className="text-3xl font-bold text-white">{avgScore}%</span>
        </div>
        <h2 className="text-2xl font-bold text-white">听写完成！</h2>
        <p className="text-white/40 mt-2">{scores.length} 个句子 · 平均正确率 {avgScore}%</p>
        <div className="flex flex-wrap gap-2 justify-center mt-4">
          {scores.map((s, i) => (
            <span key={i} className={`px-2 py-1 rounded-md text-xs font-mono ${s >= 80 ? 'bg-emerald-500/20 text-emerald-400' : s >= 50 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
              句{i + 1}: {s}%
            </span>
          ))}
        </div>
        <button onClick={onReset} className="mt-6 px-5 py-2 bg-white/[0.08] text-white/70 rounded-full text-sm hover:bg-white/[0.12] transition-colors cursor-pointer">关闭听写</button>
      </div>
    </div>
  );
}
