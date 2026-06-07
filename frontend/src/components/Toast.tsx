import { HiCheckCircle, HiXCircle, HiInformationCircle, HiXMark } from 'react-icons/hi2';
import { useToastStore } from '../stores/toastStore';

const iconMap = {
  success: HiCheckCircle,
  error: HiXCircle,
  info: HiInformationCircle,
};

const colorMap = {
  success: 'text-[#10b981]',
  error: 'text-[var(--accent)]',
  info: 'text-[#3b82f6]',
};

export default function ToastContainer() {
  const toasts = useToastStore(s => s.toasts);
  const remove = useToastStore(s => s.removeToast);
  if (toasts.length===0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t=>{
        const Icon = iconMap[t.type];
        return (
          <div key={t.id} className="pointer-events-auto glass-light flex items-center gap-3 rounded-2xl px-4 py-3 animate-scale-in border border-[var(--border-primary)]">
            <span className={colorMap[t.type]}><Icon size={18}/></span>
            <span className="text-sm text-primary">{t.message}</span>
            <button onClick={()=>remove(t.id)} className="ml-2 text-tertiary hover:text-secondary cursor-pointer">
              <HiXMark size={14}/>
            </button>
          </div>
        );
      })}
    </div>
  );
}
