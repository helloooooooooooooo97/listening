import { HiSparkles, HiXMark } from 'react-icons/hi2';
import type { DrawCandidate } from '../../lib/api';
import { cardImageUrl } from '../../lib/api';
import CardRarityBadge from './CardRarityBadge';

interface CardUnlockModalProps {
  candidates: DrawCandidate[];
  onPick: (cardId: string) => void;
  onClose: () => void;
  loading: boolean;
}

export default function CardUnlockModal({ candidates, onPick, onClose, loading }: CardUnlockModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget && !loading) onClose(); }}>
      <div className="w-full max-w-2xl mx-4 rounded-2xl shadow-2xl border border-[var(--border-primary)] overflow-hidden"
        style={{ background: 'var(--bg-primary)' }}>
        <div className="p-6 text-center">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-primary">🎴 抽卡</h2>
            <button onClick={onClose} disabled={loading}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
              <HiXMark size={16} />
            </button>
          </div>

          {loading ? (
            <div className="py-12">
              <div className="w-8 h-8 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-tertiary">匹配计算中...</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-tertiary mb-6">选择一张卡牌解锁</p>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {candidates.map(c => (
                  <button key={c.card_id} onClick={() => onPick(c.card_id)}
                    className="group relative rounded-xl overflow-hidden border border-[var(--border-primary)] hover:border-[var(--accent)]/30 transition-all duration-200 cursor-pointer text-left hover:shadow-lg"
                    style={{ background: 'var(--bg-secondary)' }}>
                    <div className="aspect-[3/4] relative overflow-hidden">
                      {c.png ? (
                        <img src={cardImageUrl(c.png)} alt={c.name}
                          className="w-full h-full object-cover scale-110 transition-transform duration-300 group-hover:scale-125" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"
                          style={{ background: 'var(--bg-tertiary)' }}>
                          <HiSparkles size={32} className="text-tertiary" />
                        </div>
                      )}
                      {c.rarity && (
                        <div className="absolute top-2 right-2">
                          <CardRarityBadge rarity={c.rarity} />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-semibold text-primary truncate">{c.name}</p>
                      <p className="text-[10px] text-tertiary mt-0.5">
                        匹配度 {c.match_score}% · {c.hits}/{c.total}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
