/** Reusable loading skeleton. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[var(--bg-tertiary)] rounded-lg ${className}`} />;
}
