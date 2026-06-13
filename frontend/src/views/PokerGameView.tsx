// ─── Poker Game View — orchestrates Lobby and Table views ───

import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePokerStore } from '../stores/pokerStore';
import { useCurrencyStore } from '../stores/currencyStore';
import { PokerLobby, PokerTableView } from '../components/game/poker';

export default function PokerGameView() {
  const navigate = useNavigate();
  const store = usePokerStore();
  const loadBalance = useCurrencyStore(s => s.loadBalance);
  const { lobbyMode, loading, starting, audioLoadProgress, game, cards, history, canPlay, balance, selectedBet, betting, error } = store;

  useEffect(() => { store.loadLobby(); }, []);
  useEffect(() => {
    if (game?.status === 'completed') loadBalance();
  }, [game?.status]);

  const cardPngMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of cards) map[c.name.toLowerCase()] = c.png;
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
        onStart={() => store.startGame()}
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
      key={game.game_id}
      onRestart={() => store.startGame()}
    />
  );
}
