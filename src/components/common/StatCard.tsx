import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export function StatCard({
  label,
  value,
  icon,
  tone = 'primary',
  hint,
  delay = 0,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'accent';
  hint?: string;
  delay?: number;
}) {
  const toneVar = {
    primary: 'var(--sf-primary)',
    success: 'var(--sf-success)',
    warning: 'var(--sf-warning)',
    danger: 'var(--sf-danger)',
    accent: 'var(--sf-accent)',
  }[tone];

  return (
    <div
      className="sf-surface group relative overflow-hidden p-4 animate-fade-up sm:p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span
        aria-hidden
        className="absolute -end-6 -top-6 h-20 w-20 rounded-full opacity-[0.09] transition-transform duration-500 group-hover:scale-125"
        style={{ background: toneVar }}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-wide text-content-muted">
            {label}
          </p>
          <p className="mt-1.5 text-2xl font-extrabold leading-none text-content sm:text-[1.7rem]">
            {value}
          </p>
          {hint && <p className="mt-1.5 text-xs text-content-muted">{hint}</p>}
        </div>
        {icon && (
          <span
            className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-theme-sm')}
            style={{ background: `color-mix(in srgb, ${toneVar} 14%, transparent)`, color: toneVar }}
          >
            {icon}
          </span>
        )}
      </div>
    </div>
  );
}
