import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi2';
import { useCardsStore } from '../stores/cardsStore';
import type { CardMeta } from '../lib/api';
import CardGrid from '../components/cards/CardGrid';
import CardDetailModal from '../components/cards/CardDetailModal';

export default function DeckDetailView() {
  const { season } = useParams<{ season: string }>();
  const navigate = useNavigate();
  const store = useCardsStore();
  const [selectedCard, setSelectedCard] = useState<CardMeta | null>(null);

  useEffect(() => {
    store.loadCards();
  }, []);

  const deckSeason = parseInt(season || '1', 10);
  const deckCards = store.cards.filter(c => (c.season || 1) === deckSeason);

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto">
      {/* Header with back button */}
      <div className="flex-shrink-0 px-6 pt-10 pb-4">
        <button onClick={() => navigate('/cards')}
          className="flex items-center gap-1.5 text-xs text-tertiary hover:text-secondary transition-colors cursor-pointer mb-3">
          <HiArrowLeft size={14} />
          返回卡组
        </button>

        {/* Deck header */}
        <div className="p-5 rounded-xl border transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary))',
            borderColor: 'var(--border-primary)',
          }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-base font-bold text-primary">{store.deckTitle}</p>
              <p className="text-[11px] text-tertiary mt-0.5">{store.deckSubtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-primary tabular-nums">
                {store.obtainedCount}<span className="text-base text-tertiary font-medium">/{store.total}</span>
              </p>
              <p className="text-[10px] text-tertiary">已收集</p>
            </div>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${store.total > 0 ? (store.obtainedCount / store.total) * 100 : 0}%`,
                background: 'linear-gradient(90deg, #fa2d48, #f59e0b)',
              }} />
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 pb-8 space-y-4">
        {/* ── Card grid ── */}
        <div>
          <p className="text-xs text-tertiary font-medium uppercase tracking-wider mb-3">
            卡牌列表 ({store.obtainedCount}/{store.total})
          </p>
          <p className="text-[10px] text-tertiary/60 mb-3">
            已翻牌可点击查看详情，未翻牌展示该卡关键词预告
          </p>
          {store.loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
            </div>
          ) : (
            <CardGrid cards={deckCards} onCardClick={c => setSelectedCard(c)} variant="deck" />
          )}
        </div>
      </div>

      {/* Card detail modal */}
      {selectedCard && (
        <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
