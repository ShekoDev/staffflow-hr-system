import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** CSS-only tooltip — no positioning library, no layout thrash. */
export function Tooltip({
  label,
  children,
  side = 'top',
  className,
}: {
  label: string;
  children: ReactNode;
  side?: 'top' | 'bottom';
  className?: string;
}) {
  return (
    <span className={cn('group/tt relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute start-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-1',
          'bg-slate-900 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150',
          'group-hover/tt:opacity-100 rtl:translate-x-1/2',
          side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
        )}
      >
        {label}
      </span>
    </span>
  );
}
