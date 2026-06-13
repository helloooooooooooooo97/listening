import { HiAdjustmentsHorizontal, HiBookOpen } from 'react-icons/hi2';
import { useEffect, useState } from 'react';
import { getWords, getLessons, getCollections } from '../../lib/api';

const EXAM_TAGS = ['CET-4', 'CET-6', 'TEM-4', 'TEM-8', 'IELTS', 'TOEFL'];

interface FilterDrawerProps {
  /** Currently selected collection dynamic type (e.g. 'all_words', 'today_words') */
  collectionFilter: string;
  /** Currently selected category name(s) */
  categoryFilter: Set<string>;
  /** Currently selected exam tag */
  examFilter: string;
  /** Called when any filter changes */
  onChange: (filters: {
    collectionFilter: string;
    categoryFilter: Set<string>;
    examFilter: string;
  }) => void;
}

export default function FilterDrawer({ collectionFilter, categoryFilter, examFilter, onChange }: FilterDrawerProps) {
  const [open, setOpen] = useState(false);
  const [collections, setCollections] = useState<{ id: number; name: string; dynamic_type: string }[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});

  // Load collections & categories for filter
  useEffect(() => {
    (async () => {
      const [lessonsData, cols] = await Promise.all([
        getLessons().catch(() => []),
        getCollections().catch(() => []),
      ]);
      const cats = [...new Set(lessonsData.map(l => l.category || 'Other'))].sort();
      setCategories(cats);
      const dynCols = cols.flatMap(c => {
        if (!c.is_dynamic || !c.dynamic_type || c.dynamic_type.startsWith('category:')) return [];
        return [{ id: c.id, name: c.name, dynamic_type: c.dynamic_type }];
      });
      setCollections(dynCols);
      const counts: Record<string, number> = {};
      const results = await Promise.all([
        getWords({ limit: 10 }).catch(() => null),
        ...cats.map(cat => getWords({ limit: 10, collection: `category:${cat}` }).catch(() => null)),
        ...dynCols.map(col => getWords({ limit: 10, collection: col.dynamic_type }).catch(() => null)),
      ]);
      if (results[0]) counts['all'] = results[0].total;
      let idx = 1;
      for (const cat of cats) {
        const result = results[idx];
        if (result) counts[`cat:${cat}`] = result.total;
        idx++;
      }
      for (const col of dynCols) {
        const result = results[idx];
        if (result) counts[`col:${col.dynamic_type}`] = result.total;
        idx++;
      }
      setFilterCounts(counts);
    })();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = () => setOpen(false);
    document.addEventListener('click', handler, { once: true });
    return () => document.removeEventListener('click', handler);
  }, [open]);

  const hasActive = !!collectionFilter || categoryFilter.size > 0 || !!examFilter;
  const activeLabel = examFilter || collectionFilter || [...categoryFilter][0] || '合集';

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
        title="按合集筛选">
        <HiAdjustmentsHorizontal size={13} />
        <span>{activeLabel}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 rounded-xl shadow-2xl border border-[var(--border-primary)] overflow-hidden z-50 animate-fade-in"
          style={{ background: 'var(--bg-secondary)' }}>
          <div className="p-2 space-y-0.5 max-h-72 overflow-y-auto">
            {/* All words */}
            <button
              onClick={() => { onChange({ collectionFilter: '', categoryFilter: new Set(), examFilter: '' }); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                !collectionFilter && categoryFilter.size === 0 && !examFilter
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
              }`}>
              <span>全部单词</span>
              <span className="text-[10px] font-mono tabular-nums opacity-60">{filterCounts['all'] ?? '…'}</span>
            </button>

            {/* Collections */}
            {collections.map(col => (
              <button key={col.id}
                onClick={() => { onChange({ collectionFilter: col.dynamic_type, categoryFilter: new Set(), examFilter: '' }); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                  collectionFilter === col.dynamic_type
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                }`}>
                <span>{col.name}</span>
                <span className="text-[10px] font-mono tabular-nums opacity-60">{filterCounts[`col:${col.dynamic_type}`] ?? '…'}</span>
              </button>
            ))}

            {/* Categories */}
            {categories.length > 0 && (
              <>
                <div className="h-px bg-[var(--border-secondary)] my-1.5" />
                {categories.map(cat => (
                  <button key={cat}
                    onClick={() => { onChange({ collectionFilter: '', categoryFilter: new Set([cat]), examFilter: '' }); setOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                      categoryFilter.has(cat)
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                        : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                    }`}>
                    <span className="flex items-center gap-1"><HiBookOpen size={11} />{cat}</span>
                    <span className="text-[10px] font-mono tabular-nums opacity-60">{filterCounts[`cat:${cat}`] ?? '…'}</span>
                  </button>
                ))}
              </>
            )}

            {/* Exam tags */}
            <div className="h-px bg-[var(--border-secondary)] my-1.5" />
            <p className="px-3 py-1 text-[10px] text-tertiary font-medium uppercase tracking-wider">🎓 按考试</p>
            {EXAM_TAGS.map(tag => (
              <button key={tag}
                onClick={() => { onChange({ collectionFilter: '', categoryFilter: new Set(), examFilter: examFilter === tag ? '' : tag }); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between ${
                  examFilter === tag
                    ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                    : 'text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)]'
                }`}>
                <span>{tag}</span>
              </button>
            ))}
          </div>

          {hasActive && (
            <div className="border-t border-[var(--border-secondary)] p-2">
              <button onClick={() => { onChange({ collectionFilter: '', categoryFilter: new Set(), examFilter: '' }); setOpen(false); }}
                className="w-full text-xs text-center py-1.5 rounded-lg text-tertiary hover:text-secondary hover:bg-[var(--bg-hover)] transition-colors cursor-pointer">
                清除筛选
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { EXAM_TAGS };
