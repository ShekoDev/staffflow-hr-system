import { cn } from '@/lib/cn';

export function ProgressBar({
  value,
  max = 100,
  color,
  className,
  showLabel = false,
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
  showLabel?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-content-muted/15">
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: color ?? 'var(--sf-primary)' }}
        />
      </div>
      {showLabel && (
        <span className="w-10 shrink-0 text-end text-xs font-semibold text-content-muted">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
