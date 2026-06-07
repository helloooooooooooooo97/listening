import type { WordResult } from '../../stores/dictationStore';

interface Props {
  results: WordResult[];
}

/** Merges adjacent missing+extra into "wrong" pairs, then renders colored badges */
export default function WordBadges({ results }: Props) {
  const merged: WordResult[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === 'missing' && i + 1 < results.length && results[i + 1].status === 'extra') {
      merged.push({ expected: r.expected, actual: results[i + 1].actual, status: 'wrong' });
      i++;
    } else {
      merged.push(r);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {merged.map((r, i) => {
        if (r.status === 'correct') {
          return <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/20 text-emerald-400">{r.expected}</span>;
        }
        if (r.status === 'wrong') {
          return <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-red-500/20 text-red-400"><span className="line-through">{r.actual}</span><span>→</span><span className="text-emerald-400">{r.expected}</span></span>;
        }
        if (r.status === 'missing') {
          return <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-300/50 italic">{r.expected}</span>;
        }
        if (r.status === 'extra') {
          return <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-amber-500/20 text-amber-400 line-through">{r.actual}</span>;
        }
        return null;
      })}
    </div>
  );
}
