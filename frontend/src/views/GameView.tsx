import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiArrowPath, HiSparkles } from 'react-icons/hi2';
import { useGameStore } from '../stores/gameStore';
import { getTodayWords, getDueWords, getWords } from '../lib/api';
import GameBoard from '../components/game/GameBoard';
import SlotBar from '../components/game/SlotBar';
import GameModal from '../components/game/GameModal';
import GameLevelSelect from '../components/game/GameLevelSelect';
import type { Difficulty } from '../components/game/levelGenerator';

export default function GameView() {
  const navigate = useNavigate();
  const store = useGameStore();
  const [allWords, setAllWords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // On mount, gather available words
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

  const handleStart = (difficulty: Difficulty, source: string) => {
    let words: string[] = [];
    if (source === 'today') {
      getTodayWords().then(d => { store.initGame(d.words.map(w => w.word), difficulty); }).catch(() => {});
      return;
    }
    if (source === 'review') {
      getDueWords(200).then(d => { store.initGame(d.words.map(w => w.word), difficulty); }).catch(() => {});
      return;
    }
    store.initGame(allWords, difficulty);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="w-6 h-6 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
      </div>
    );
  }

  // Level select screen
  if (store.status === 'idle') {
    return (
      <div className="h-full bg-[var(--bg-primary)] overflow-y-auto">
        <GameLevelSelect onStart={handleStart} onBack={() => navigate(-1)} />
      </div>
    );
  }

  // Game over modal
  if (store.status === 'won' || store.status === 'lost') {
    return (
      <div className="h-full bg-[var(--bg-primary)] overflow-y-auto">
        <GameHeader />
        <div className="px-4 py-8">
          <GameBoard tiles={store.tiles} inDegree={store.inDegree} onTileClick={store.clickTile} />
          <div className="mt-6">
            <SlotBar slot={store.slot} capacity={store.slotCapacity} />
          </div>
        </div>
        <GameModal
          isWin={store.status === 'won'}
          matchedCount={store.matchedWords.length}
          totalWords={store.totalWords}
          elapsed={store.elapsed}
          onReplay={() => store.initGame(store.words, store.difficulty)}
          onQuit={() => { store.reset(); }}
        />
      </div>
    );
  }

  // Playing
  return (
    <div className="h-full bg-[var(--bg-primary)] flex flex-col overflow-y-auto">
      <GameHeader />

      {/* Progress */}
      <div className="px-6 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            <HiSparkles size={11} className="inline mr-1" style={{ color: 'var(--accent)' }} />
            {store.matchedWords.length}/{store.totalWords} 消除
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

      {/* Board */}
      <div className="flex-1 flex items-center justify-center px-4 py-4">
        <GameBoard tiles={store.tiles} inDegree={store.inDegree} onTileClick={store.clickTile} />
      </div>

      {/* Slot + Tools (same container) */}
      <div className="pb-6 flex justify-center">
        <SlotBar
          slot={store.slot}
          capacity={store.slotCapacity}
          tools={store.tools}
          onShuffle={store.useShuffle}
          onUndo={store.useUndo}
          onRemove3={store.useRemove3}
        />
      </div>
    </div>
  );
}

function GameHeader() {
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
      <button onClick={() => store.initGame(store.words, store.difficulty)}
        className="flex items-center gap-1 text-xs transition-colors cursor-pointer"
        style={{ color: 'var(--text-tertiary)' }}>
        <HiArrowPath size={13} />
      </button>
    </div>
  );
}
