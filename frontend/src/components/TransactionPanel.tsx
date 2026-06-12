import { useEffect, useState } from 'react';
import { HiXMark, HiCubeTransparent, HiPlay, HiPencilSquare, HiMicrophone, HiSparkles, HiSun } from 'react-icons/hi2';
import { getCurrencyTransactions } from '../lib/api';
import { useCurrencyStore } from '../stores/currencyStore';
import type { CurrencyTransaction } from '../lib/api';

const SOURCE_META: Record<string, { label: string; icon: React.ComponentType<{ size?: number }>; color: string }> = {
  listen:      { label: '听音频',   icon: HiPlay,          color: '#3b82f6' },
  review:      { label: '复习单词', icon: HiPencilSquare,  color: '#10b981' },
  dictation:   { label: '听写',     icon: HiMicrophone,    color: '#a855f7' },
  daily_bonus: { label: '每日奖励', icon: HiSun,           color: '#f59e0b' },
  draw:        { label: '抽卡消耗', icon: HiSparkles,      color: '#fa2d48' },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function TransactionPanel({ open, onClose }: Props) {
  const [txs, setTxs] = useState<CurrencyTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const loadBalance = useCurrencyStore(s => s.loadBalance);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    loadBalance();
    getCurrencyTransactions().then(r => setTxs(r.transactions)).catch(() => {}).finally(() => setLoading(false));
  }, [open]);

  if (!open) return null;

  const formatTime = (ts: number) => {
    // ts is a Unix timestamp in seconds
    const d = new Date(ts * 1000);
    if (isNaN(d.getTime())) return String(ts);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-lg max-h-[80vh] rounded-2xl border overflow-hidden flex flex-col"
        style={{
          background: 'var(--bg-primary)',
          borderColor: 'var(--border-primary)',
        }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-2">
            <HiCubeTransparent size={16} className="text-[var(--accent)]" />
            <span className="text-sm font-bold text-primary">交易记录</span>
          </div>
          <button onClick={onClose} className="text-tertiary hover:text-secondary cursor-pointer p-1">
            <HiXMark size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-white/10 border-t-[#fa2d48] rounded-full animate-spin" />
            </div>
          ) : txs.length === 0 ? (
            <p className="text-center text-xs text-tertiary py-8">暂无交易记录</p>
          ) : (
            txs.map(tx => {
              const meta = SOURCE_META[tx.source] || { label: tx.source, icon: HiCubeTransparent, color: '#6b7280' };
              const Icon = meta.icon;
              return (
                <div key={tx.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors hover:bg-[var(--bg-hover)]">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: meta.color + '15' }}>
                    <Icon size={14} style={{ color: meta.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-primary">{meta.label}</p>
                    <p className="text-[10px] text-tertiary truncate">
                      {tx.ref_summary || tx.ref_id}
                      <span className="ml-2 opacity-60">{formatTime(tx.created_at)}</span>
                    </p>
                  </div>
                  <span className={`text-xs font-bold tabular-nums flex-shrink-0 ${tx.amount >= 0 ? 'text-emerald-400' : 'text-[var(--accent)]'}`}>
                    {tx.amount >= 0 ? '+' : ''}{tx.amount}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
