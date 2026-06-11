const RARITY_STYLES: Record<string, string> = {
  R: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  SR: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  SSR: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  UR: 'bg-amber-400/20 text-amber-300 border-amber-400/30',
};

export default function CardRarityBadge({ rarity }: { rarity: string }) {
  const s = RARITY_STYLES[rarity] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${s}`}>
      {rarity}
    </span>
  );
}
