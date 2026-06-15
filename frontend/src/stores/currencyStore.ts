import { create } from 'zustand';
import { getCurrencyBalance, syncCurrency } from '../lib/api';

export interface CurrencyStore {
  balance: number;
  earned: number;
  spent: number;
  loading: boolean;

  loadBalance: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useCurrencyStore = create<CurrencyStore>((set) => ({
  balance: 0,
  earned: 0,
  spent: 0,
  loading: false,

  loadBalance: async () => {
    set({ loading: true });
    try {
      const data = await getCurrencyBalance();
      set({ balance: data.balance, earned: data.earned, spent: data.spent });
    } catch { /* ignore */ }
    set({ loading: false });
  },

  refresh: async () => {
    try {
      const data = await syncCurrency();
      set({ balance: data.balance });
    } catch { /* ignore */ }
  },
}));
