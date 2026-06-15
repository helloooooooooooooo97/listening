import { useEffect, useState } from 'react';
import { HiCubeTransparent } from 'react-icons/hi2';
import { useCurrencyStore } from '../stores/currencyStore';
import TransactionPanel from './TransactionPanel';

export default function CurrencyBadge() {
  const balance = useCurrencyStore(s => s.balance);
  const loading = useCurrencyStore(s => s.loading);
  const loadBalance = useCurrencyStore(s => s.loadBalance);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    loadBalance();
  }, []);

  return (
    <>
      <button onClick={() => setPanelOpen(true)}
        className="w-full inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:opacity-85"
        style={{
          background: 'linear-gradient(135deg, rgba(250,45,72,0.1), rgba(245,158,11,0.08))',
          border: '1px solid rgba(250,45,72,0.15)',
        }}>
        <HiCubeTransparent size={13} className="text-[var(--accent)]" />
        <span className="text-primary tabular-nums">
          {loading ? '...' : balance}
        </span>
        <span className="text-[9px] text-tertiary font-medium">IP</span>
      </button>

      <TransactionPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
