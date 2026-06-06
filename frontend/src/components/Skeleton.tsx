/** Reusable loading skeleton. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.04] rounded-lg ${className}`} />;
}
