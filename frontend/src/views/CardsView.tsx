import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiRectangleStack, HiHeart, HiChevronRight, HiSparkles, HiCheckCircle, HiArrowPath, HiAcademicCap, HiBookOpen, HiCubeTransparent } from 'react-icons/hi2';
import { useCardsStore } from '../stores/cardsStore';
import type { CardMeta } from '../lib/api';
import CardDetailModal from '../components/cards/CardDetailModal';
import CardRarityBadge from '../components/cards/CardRarityBadge';
import { cardImageUrl } from '../lib/api';

type Tab = 'decks' | 'collection';

const DECK_STYLES: Record<number, { gradient: string; icon: string }> = {
  1: {
    gradient: 'linear-gradient(135deg, #fa2d4808, #f59e0b08)',
    icon: '🏆',
  },
};

export default function CardsView() {
  const store = useCardsStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('decks');
  const [selectedCard, setSelectedCard] = useState<CardMeta | null>(null);
  const [flippedCard, setFlippedCard] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    store.loadCards();
    store.checkDraw();
  }, []);

  const collected = store.cards.filter(c => c.obtained);

  const handleDraw = async () => {
    await store.startDraw();
    setFlippedCard(null);
    setCelebrate(false);
  };

  const handlePickWord = async (word: string) => {
    setFlippedCard(word);
    setTimeout(async () => {
      await store.pickWord(word);
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 2000);
    }, 600);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-primary)] overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-10 pb-4">
        <h1 className="text-2xl font-extrabold text-primary mb-4">卡组</h1>
        <div className="flex gap-1">
          {[
            { key: 'decks' as Tab, label: '所有卡组', icon: HiRectangleStack },
            { key: 'collection' as Tab, label: '我的收藏', icon: HiHeart },
          ].map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  tab === t.key
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                }`}>
                <Icon size={13} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 px-6 pb-8">
        {/* ── Decks tab ── */}
        {tab === 'decks' && (
          <div className="space-y-5">
            {/* ── Draw section (at top of decks tab) ── */}
            <div className="p-5 rounded-xl border"
              style={{
                background: store.showResult && store.drawnCard
                  ? 'linear-gradient(135deg, rgba(250,45,72,0.05), rgba(245,158,11,0.05))'
                  : 'var(--bg-tertiary)',
                borderColor: celebrate ? 'rgba(250,45,72,0.3)' : 'var(--border-primary)',
                transition: 'all 0.5s',
                boxShadow: celebrate ? '0 0 30px rgba(250,45,72,0.15)' : 'none',
              }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <HiCubeTransparent size={16} className="text-[var(--accent)]" />
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      {store.showResult && store.drawnCard ? '✨ 抽卡结果' : '抽卡'}
                    </p>
                    {!store.showWords && !store.showResult && (
                      <p className="text-xs text-tertiary mt-0.5">
                        已复习 <strong className="text-primary">{store.newWordsSinceDraw}</strong> / {store.minNewWords} 词
                        {store.qualifiedCandidates > 0 ? ` · ${store.qualifiedCandidates} 张卡可匹配` : ''}
                      </p>
                    )}
                  </div>
                </div>
                {!store.showWords && !store.showResult && (
                  <button onClick={handleDraw} disabled={!store.canDraw || store.drawLoading}
                    className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer whitespace-nowrap
                      ${store.canDraw
                        ? 'bg-[var(--accent)] on-accent hover:opacity-90 hover:scale-105 active:scale-95'
                        : 'bg-[var(--bg-secondary)] text-tertiary opacity-50 cursor-not-allowed'
                      }`}>
                    {store.drawLoading ? (
                      <div className="w-4 h-4 border-2 border-white/10 border-t-white rounded-full animate-spin" />
                    ) : (
                      <HiSparkles size={16} />
                    )}
                    抽卡
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {!store.showWords && !store.showResult && (
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                    style={{ width: `${Math.min(100, (store.newWordsSinceDraw / store.minNewWords) * 100)}%` }} />
                </div>
              )}

              {/* ── Word picker ── */}
              {store.showWords && store.drawWords.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-tertiary mb-4 text-center">选择其中一个单词，揭晓对应的卡牌</p>
                  <div className="flex gap-4 justify-center">
                    {store.drawWords.map((dw, i) => (
                      <div key={i} className="relative perspective-[1000px]" style={{ width: 150, height: 110 }}>
                        <button onClick={() => !flippedCard && handlePickWord(dw.word)}
                          disabled={!!flippedCard}
                          className={`relative w-full h-full rounded-xl border-2 text-sm transition-all duration-500 cursor-pointer flex flex-col items-center justify-center gap-1
                            ${flippedCard === dw.word
                              ? 'opacity-0 scale-95'
                              : 'hover:border-[var(--accent)]/40 hover:-translate-y-1 hover:shadow-lg active:scale-95'
                            }
                            ${flippedCard && flippedCard !== dw.word ? 'opacity-30 scale-90' : ''}
                          `}
                          style={{
                            background: 'var(--bg-secondary)',
                            borderColor: flippedCard
                              ? 'var(--border-secondary)'
                              : 'var(--border-primary)',
                            animation: !flippedCard ? `float-${i} 3s ease-in-out infinite` : 'none',
                            animationDelay: `${i * 0.3}s`,
                          }}>
                          <span className={`font-semibold ${flippedCard === dw.word ? 'opacity-0' : ''}`}>
                            {dw.word}
                          </span>
                          <span className={`text-[9px] text-tertiary opacity-60 ${flippedCard === dw.word ? 'opacity-0' : ''}`}>
                            {dw.deck}
                          </span>
                        </button>
                      </div>
                    ))}
                  </div>
                  <style>{`
                    @keyframes float-0 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
                    @keyframes float-1 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
                    @keyframes float-2 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
                  `}</style>
                </div>
              )}

              {/* ── Draw result ── */}
              {store.showResult && store.drawnCard && (
                <div className={`mt-4 transition-all duration-500 ${celebrate ? 'scale-[1.02]' : 'scale-100'}`}>
                  <div className="flex items-center gap-5 p-4 rounded-xl border relative"
                    style={{
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                      animation: celebrate ? 'reveal-pop 0.5s ease-out' : 'none',
                    }}>
                    <div className="w-24 flex-shrink-0">
                      <img src={cardImageUrl(store.drawnCard.png)} alt={store.drawnCard.name}
                        className="w-full rounded-xl object-cover transition-transform duration-500"
                        style={{ animation: celebrate ? 'card-float 2s ease-in-out infinite' : 'none' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-base font-bold text-primary truncate">{store.drawnCard.name}</p>
                        <CardRarityBadge rarity={store.drawnCard.rarity} />
                      </div>
                      <p className="text-[11px] text-tertiary">{store.drawnCard.title}</p>
                      {store.drawnCard.motto && (
                        <p className="text-[10px] text-tertiary italic mt-1 truncate">"{store.drawnCard.motto}"</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                          <HiCheckCircle size={10} /> 已收藏
                        </span>
                        <span className="text-[10px] text-tertiary">匹配度 {store.drawnCard.match_score}%</span>
                      </div>
                    </div>
                    <button onClick={store.clearDraw}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--accent)] on-accent hover:opacity-90 transition-opacity cursor-pointer whitespace-nowrap flex items-center gap-1">
                      <HiArrowPath size={12} /> 继续
                    </button>

                    {/* Sparkle overlay */}
                    {celebrate && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                        {[...Array(6)].map((_, i) => (
                          <span key={i}
                            className="absolute w-1.5 h-1.5 bg-[var(--accent)] rounded-full"
                            style={{
                              top: `${20 + Math.random() * 60}%`,
                              left: `${10 + Math.random() * 80}%`,
                              animation: `sparkle-${i} 1.5s ease-out infinite`,
                              animationDelay: `${i * 0.2}s`,
                              opacity: 0,
                            }} />
                        ))}
                        <style>{`
                          ${[...Array(6)].map((_, i) => `
                            @keyframes sparkle-${i} {
                              0% { opacity: 0; transform: scale(0) translateY(0); }
                              50% { opacity: 1; transform: scale(1.5) translateY(-20px); }
                              100% { opacity: 0; transform: scale(0) translateY(-40px); }
                            }
                          `).join('')}
                          @keyframes reveal-pop {
                            0% { transform: scale(0.8); opacity: 0.5; }
                            50% { transform: scale(1.03); }
                            100% { transform: scale(1); opacity: 1; }
                          }
                          @keyframes card-float {
                            0%,100% { transform: translateY(0); }
                            50% { transform: translateY(-4px); }
                          }
                        `}</style>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* ── Deck cards grid ── */}
            {store.loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {store.deckTitle && (
                  <button
                    onClick={() => navigate(`/cards/${store.deckSeason}`)}
                    className="group relative rounded-xl border overflow-hidden transition-all duration-300 cursor-pointer text-left hover:shadow-lg hover:border-[var(--accent)]/20 active:scale-[0.98]"
                    style={{
                      background: DECK_STYLES[store.deckSeason]?.gradient || 'var(--bg-secondary)',
                      borderColor: 'var(--border-primary)',
                    }}>
                    <div className="aspect-[3/4] flex flex-col p-4 relative">
                      {/* Season badge */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base flex-shrink-0"
                          style={{ background: 'var(--bg-secondary)' }}>
                          {DECK_STYLES[store.deckSeason]?.icon || '🎴'}
                        </div>
                        <span className="text-xs px-2 py-1 rounded-lg font-bold"
                          style={{
                            background: 'var(--accent)/10',
                            color: 'var(--accent)',
                            border: '1px solid var(--accent)/15',
                          }}>
                          S{store.deckSeason}
                        </span>
                      </div>

                      {/* Title area - centered vertically */}
                      <div className="flex-1 flex flex-col justify-center text-center px-1">
                        <h3 className="text-lg font-black text-primary leading-tight">{store.deckTitle}</h3>
                        {store.deckSubtitle && (
                          <p className="text-sm text-tertiary mt-2 font-medium">{store.deckSubtitle}</p>
                        )}
                      </div>

                      {/* Progress at bottom */}
                      <div className="mt-auto">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{
                                width: `${store.total > 0 ? (store.obtainedCount / store.total) * 100 : 0}%`,
                                background: 'linear-gradient(90deg, #fa2d48, #f59e0b)',
                              }} />
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-primary tabular-nums text-right">
                          {store.obtainedCount}<span className="text-[10px] text-tertiary font-medium">/{store.total}</span>
                        </p>
                      </div>
                    </div>
                  </button>
                )}

                {/* Placeholder for future decks */}
                <div className="aspect-[3/4] rounded-xl border border-dashed border-[var(--border-secondary)] flex flex-col items-center justify-center gap-2 opacity-40"
                  style={{ background: 'var(--bg-tertiary)' }}>
                  <HiAcademicCap size={22} className="text-tertiary" />
                  <p className="text-[10px] text-tertiary text-center leading-tight px-2">更多卡组<br/>即将到来</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Collection tab ── */}
        {tab === 'collection' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-[var(--border-primary)]"
              style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-3">
                <HiHeart size={20} className="text-[var(--accent)]" />
                <div>
                  <p className="text-sm font-semibold text-primary">我的收藏</p>
                  <p className="text-[11px] text-tertiary mt-0.5">
                    已收藏 {collected.length} / {store.total} 张卡牌
                  </p>
                </div>
              </div>
            </div>

            {collected.length === 0 ? (
              <div className="text-center py-16">
                <HiHeart size={40} className="mx-auto text-tertiary opacity-30 mb-3" />
                <p className="text-sm text-tertiary">还没有收藏任何卡牌</p>
                <p className="text-xs text-tertiary mt-1 opacity-60">复习新词 → 抽卡收集传奇人物</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                {collected.map(card => (
                  <button key={card.id} onClick={() => setSelectedCard(card)}
                    className="group relative rounded-xl overflow-hidden border border-[var(--border-primary)] transition-all duration-200 cursor-pointer text-left hover:shadow-lg hover:border-[var(--accent)]/30"
                    style={{ background: 'var(--bg-secondary)' }}>
                    <div className="aspect-[3/4] relative overflow-hidden">
                      <img src={cardImageUrl(card.png)} alt={card.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      <div className="absolute top-2 right-2">
                        <CardRarityBadge rarity={card.rarity} />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 p-2"
                        style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
                        <p className="text-xs font-semibold text-white truncate">{card.name}</p>
                      </div>
                    </div>
                    <div className="absolute top-2 left-2">
                      <span className="text-[8px] px-1 py-0.5 rounded bg-black/40 text-white/70">
                        S{card.season || store.deckSeason}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card detail modal */}
      {selectedCard && (
        <CardDetailModal card={selectedCard} onClose={() => setSelectedCard(null)} />
      )}
    </div>
  );
}
