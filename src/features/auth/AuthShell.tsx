import type { ReactNode } from 'react';
import { useI18n } from '@/i18n';

/** Split-screen shell shared by every unauthenticated page. */
export function AuthShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel — hidden on small screens so the form gets the space */}
      <aside
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12"
        style={{
          background:
            'linear-gradient(140deg, var(--sf-primary) 0%, color-mix(in srgb, var(--sf-accent) 70%, var(--sf-primary)) 100%)',
        }}
      >
        <span
          aria-hidden
          className="absolute -end-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl"
        />
        <span
          aria-hidden
          className="absolute -bottom-28 -start-16 h-80 w-80 rounded-full bg-black/10 blur-2xl"
        />

        <div className="relative animate-fade-up">
          <p className="text-4xl font-extrabold tracking-[0.18em] text-white">STAFFFLOW</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/85">
            {t('common.appSubtitle')}
          </p>
        </div>

        <ul className="relative space-y-3 text-sm text-white/90">
          {[
            t('nav.employees'),
            t('nav.attendance'),
            t('nav.evaluations'),
            t('nav.monthlyRanking'),
          ].map((item, index) => (
            <li
              key={item}
              className="flex items-center gap-3 animate-slide-in"
              style={{ animationDelay: `${180 + index * 90}ms` }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
              {item}
            </li>
          ))}
        </ul>

        <p className="relative text-xs text-white/70">{t('splash.copyright')}</p>
      </aside>

      <main className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </main>
    </div>
  );
}
