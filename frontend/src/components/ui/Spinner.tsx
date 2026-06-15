// ─── Unified Spinner Component ───
// Replaces all inline spinner implementations across the project.

interface SpinnerProps {
  /** Width & height in px (default 20) */
  size?: number;
  /** Accent color — defaults to theme accent (var(--accent)) */
  accent?: string;
  /** Optional label shown to the right of the spinner */
  label?: string;
  /** Additional classes on the wrapper */
  className?: string;
}

export default function Spinner({
  size = 20,
  accent,
  label,
  className = '',
}: SpinnerProps) {
  const wh = `${size}px`;
  const borderW = Math.max(2, Math.round(size / 10));

  return (
    <div className={`inline-flex items-center justify-center gap-2 ${className}`}>
      <span
        className="inline-block rounded-full animate-spin"
        style={{
          width: wh,
          height: wh,
          border: `${borderW}px solid rgba(255,255,255,0.08)`,
          borderTopColor: accent || 'var(--accent, #fa2d48)',
        }}
      />
      {label && (
        <span className="text-xs text-tertiary animate-pulse">{label}</span>
      )}
    </div>
  );
}
