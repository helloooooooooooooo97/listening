// ─── Poker Game View — orchestrates Lobby and Table views ───

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePokerStore } from '../stores/pokerStore';
import { useCurrencyStore } from '../stores/currencyStore';
import { PokerLobby, PokerTableView, PokerV2TableView } from '../components/game/poker';

export default function PokerGameView() {
  const navigate = useNavigate();
  const store = usePokerStore();
  const loadBalance = useCurrencyStore(s => s.loadBalance);
  const { lobbyMode, loading, starting, audioLoadProgress, game, cards, history, canPlay, balance, selectedBet, betting, error, v2Mode, v2RoundResult, v2RoundNum, v2TotalRounds, v2TotalNet, v2SessionOver } = store;

  useEffect(() => { store.loadLobby(); }, []);
  useEffect(() => {
    if (game?.status === 'completed') loadBalance();
  }, [game?.status]);

  const cardPngMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of cards) {
      map[c.name.toLowerCase()] = c.png;
    }
    return map;
  }, [cards]);

  if (lobbyMode === 'lobby') {
    return (
      <PokerLobby
        cards={cards}
        history={history}
        canPlay={canPlay}
        balance={balance}
        loading={loading}
        starting={starting}
        audioLoadProgress={audioLoadProgress}
        error={error}
        onClearError={store.clearError}
        onBack={() => navigate(-1)}
        onStart={store.startGame}
        onStartV2={() => store.startV2Game()}
      />
    );
  }

  // v2 mode
  if (v2Mode) {
    if (!v2RoundResult) {
      return (
        <div className="h-full flex items-center justify-center bg-[#0a0a1a]">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-3">🎲</div>
            <p className="text-sm text-tertiary">正在开始...</p>
          </div>
        </div>
      );
    }
    return (
      <PokerV2TableView
        roundResult={v2RoundResult}
        roundNum={v2RoundNum}
        totalRounds={v2TotalRounds}
        totalNet={v2TotalNet}
        sessionOver={v2SessionOver}
        error={error}
        onPlayNext={() => store.playV2Round()}
        onBack={() => { store.backToLobby(); store.loadLobby(); }}
      />
    );
  }

  if (!game) return null;

  return (
    <PokerTableView
      game={game}
      cardPngMap={cardPngMap}
      selectedBet={selectedBet}
      betting={betting}
      error={error}
      onClearError={store.clearError}
      onSetBet={store.setSelectedBet}
      onAction={store.doAction}
      onBack={() => { store.backToLobby(); store.loadLobby(); }}
    />
  );
}
