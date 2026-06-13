import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiArrowPath, HiSparkles, HiXMark } from 'react-icons/hi2';
import { useGameStore } from '../stores/gameStore';
import Spinner from '../components/ui/Spinner';
import { getTodayWords, getDueWords, getWords } from '../lib/api';
import { useWordAudio, preloadWordsAudio } from '../hooks/useWordAudio';
import GameBoard from '../components/game/GameBoard';
import SlotBar from '../components/game/SlotBar';
import GameModal from '../components/game/GameModal';
import GameLevelSelect from '../components/game/GameLevelSelect';
import type { Difficulty } from '../components/game/levelGenerator';

export default function GameView() {
  const navigate = useNavigate();
  const store = useGameStore();
  const { playWordOnClick } = useWordAudio();
  const [allWords, setAllWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [preloadProgress, setPreloadProgress] = useState(0);

  useEffect(() => {
    if (store.difficultyMessage) {
      const timer = setTimeout(() => store.clearDifficultyMessage(), 3000);
      return () => clearTimeout(timer);
    }
  }, [store.difficultyMessage, store]);

  const handleTileClick = useCallback((tileId: string) => {
    const word = useGameStore.getState().tiles.find(t => t.id === tileId)?.word;
    if (word) playWordOnClick(word);
    store.clickTile(tileId);
  }, [store, playWordOnClick]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getTodayWords().then(d => d.words.map(w => w.word)).catch(() => []),
      getDueWords(200).then(d => d.words.map(w => w.word)).catch(() => []),
      getWords({ limit: 500 }).then(d => d.words.map(w => w.word)).catch(() => []),
    ]).then(([today, due, all]) => {
      const combined = [...new Set([...today, ...due, ...all])];
      setAllWords(combined.length > 0 ? combined : ['hello', 'world', 'apple', 'book', 'cat', 'dog', 'fish', 'bird', 'tree', 'sun']);
      setLoading(false);
    });
  }, []);

  const tryStartGame = useCallback(async (words: string[], difficulty: Difficulty, source: string) => {
    setStartError(null);
    setPreloadProgress(0);
    const ok = store.initGame(words, difficulty, source);
    if (!ok) {
      setStartError('单词不足，请选择其他来源或降低难度');
      return;
    }
    await preloadWordsAudio(useGameStore.getState().words, ({ done, total, phase }) => {
      const base = phase === 'metadata' ? 0 : 55;
      const span = phase === 'metadata' ? 55 : 45;
      setPreloadProgress(total > 0 ? Math.min(100, Math.round(base + (done / total) * span)) : base);
    });
    setPreloadProgress(100);
  }, [store]);

  const handleStart = async (difficulty: Difficulty, source: string) => {
    setStarting(true);
    setStartError(null);
    try {
      if (source === 'today') {
        const d = await getTodayWords();
        await tryStartGame(d.words.map(w => w.word), difficulty, 'today');
        return;
      }
      if (source === 'review') {
        const d = await getDueWords(200);
        await tryStartGame(d.words.map(w => w.word), difficulty, 'review');
        return;
      }
      await tryStartGame(allWords, difficulty, 'all');
    } catch {
      setStartError('加载失败，请检查网络后重试');
    } finally {
      setStarting(false);
    }
  };

  const handleReplay = useCallback(() => {
    const s = useGameStore.getState();
    void tryStartGame(s.words, s.difficulty, s.gameSource);
  }, [tryStartGame]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
        <Spinner size={24} />
      </div>
    );
  }

  if (starting) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)] px-8">
        <div className="w-full max-w-xs flex flex-col items-center gap-5">
          <Spinner size={42} />
          <div className="w-full text-center">
            <p className="text-sm font-semibold text-primary">正在缓冲本局音频</p>
            <p className="text-xs text-tertiary mt-1">准备好后再开始，点击会更干脆</p>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden bg-white/5">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
              style={{ width: `${preloadProgress}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-tertiary">{preloadProgress}%</span>
        </div>
      </div>
    );
  }

  if (store.status === 'idle') {
    return (
      <div className="h-full bg-[var(--bg-primary)] overflow-y-auto">
        {startError && (
          <div className="mx-6 mt-4 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between gap-2"
            style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--text-secondary)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span>{startError}</span>
            <button onClick={() => setStartError(null)} className="text-tertiary hover:text-secondary cursor-pointer">
              <HiXMark size={14} />
            </button>
          </div>
        )}
        <GameLevelSelect
          onStart={handleStart}
          onBack={() => navigate(-1)}
          onPlaySample={w => playWordOnClick(w)}
          starting={starting}
        />
      </div>
    );
  }

  if (store.status === 'won' || store.status === 'lost') {
    return (
      <div className="h-full bg-[var(--bg-primary)] overflow-y-auto">
        <GameHeader onRestart={handleReplay} />
        <div className="px-4 py-8">
          <GameBoard tiles={store.tiles} inDegree={store.inDegree} onTileClick={handleTileClick} />
          <div className="mt-6">
            <SlotBar slot={store.slot} capacity={store.slotCapacity} />
          </div>
        </div>
        <GameModal
          isWin={store.status === 'won'}
          matchedCount={store.matchedWords.length}
          totalWords={store.totalWords}
          elapsed={store.elapsed}
          matchedWords={store.matchedWords}
          onReplay={handleReplay}
          onQuit={() => { store.reset(); }}
        />
      </div>
    );
  }

  return (
    <div className="h-full bg-[var(--bg-primary)] flex flex-col overflow-y-auto relative">
      {store.difficultyMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-lg text-xs font-medium animate-fade-in"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}>
          {store.difficultyMessage}
        </div>
      )}
      <GameHeader onRestart={handleReplay} />

      <div className="px-6 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            <HiSparkles size={11} className="inline mr-1" style={{ color: 'var(--accent)' }} />
            <span key={store.matchedWords.length} className="inline-block animate-speed-pop tabular-nums">
              {store.matchedWords.length}
            </span>
            /{store.totalWords} 消除
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {Math.floor(store.elapsed / 60)}:{String(store.elapsed % 60).padStart(2, '0')}
          </span>
        </div>
        <div className="h-0.5 bg-white/5 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-white/20 transition-all duration-300"
            style={{ width: `${store.totalWords > 0 ? (store.matchedWords.length / store.totalWords) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-4 relative">
        {store.slot.filter(s => s !== null).length >= store.slotCapacity && (
          <div className="absolute inset-0 z-10 rounded-lg pointer-events-none"
            style={{ background: 'rgba(0,0,0,0.15)' }} />
        )}
        <GameBoard tiles={store.tiles} inDegree={store.inDegree} onTileClick={handleTileClick} />
      </div>

      <div className="pb-6 flex justify-center">
        <SlotBar
          slot={store.slot}
          capacity={store.slotCapacity}
          tools={store.tools}
          lastMatchSuccess={store.lastMatchSuccess}
          onShuffle={store.useShuffle}
          onUndo={store.useUndo}
          onRemove3={store.useRemove3}
        />
      </div>
    </div>
  );
}

function GameHeader({ onRestart }: { onRestart: () => void }) {
  const navigate = useNavigate();
  const store = useGameStore();
  return (
    <div className="flex items-center justify-between px-4 pt-12 pb-2">
      <button onClick={() => { store.reset(); navigate(-1); }}
        className="flex items-center gap-1 text-xs transition-colors cursor-pointer"
        style={{ color: 'var(--text-tertiary)' }}>
        <HiArrowLeft size={14} />
      </button>
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {store.difficulty === 'easy' ? '简单' : store.difficulty === 'medium' ? '中等' : '困难'}
      </span>
      <button onClick={onRestart}
        className="flex items-center gap-1 text-xs transition-colors cursor-pointer"
        style={{ color: 'var(--text-tertiary)' }}>
        <HiArrowPath size={13} />
      </button>
    </div>
  );
}
