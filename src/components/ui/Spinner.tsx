import { cn } from '@/lib/cn';

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

export function FullPageSpinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-3 text-content-muted">
      <Spinner size={28} className="text-primary" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
