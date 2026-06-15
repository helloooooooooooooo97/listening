// ─── Action Button — poker betting controls ───

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
  variant: 'primary' | 'secondary' | 'danger';
}

const BTN_STYLES: Record<string, { bg: string; color: string; border: string; shadow: string }> = {
  primary: {
    bg: 'linear-gradient(135deg, var(--accent), #ff6b7f)',
    color: '#fff',
    border: 'none',
    shadow: '0 2px 10px rgba(250,45,72,0.3)',
  },
  secondary: {
    bg: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.08)',
    shadow: 'none',
  },
  danger: {
    bg: 'rgba(239,68,68,0.1)',
    color: 'rgba(239,68,68,0.7)',
    border: '1px solid rgba(239,68,68,0.15)',
    shadow: 'none',
  },
};

export default function ActionButton({
  icon, label, onClick, disabled, variant,
}: ActionButtonProps) {
  const s = BTN_STYLES[variant];

  return (
    <button onClick={onClick} disabled={disabled}
      className="flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer
        disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
      style={{
        background: s.bg,
        color: s.color,
        border: s.border,
        boxShadow: s.shadow,
      }}>
      <span className="flex items-center justify-center gap-1.5">
        {icon}
        {label}
      </span>
    </button>
  );
}
