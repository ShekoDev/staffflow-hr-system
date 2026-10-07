import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { useSettings } from '@/providers/SettingsProvider';

const SEEN_KEY = 'staffflow.splash.seen';

/**
 * Opening animation.
 *
 * The centre slot is a *replaceable* media area: switch `splash.media_type`
 * in System Settings to image / video and point `media_url` at the asset —
 * no code change needed to swap in the final company intro.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const { t, localized } = useI18n();
  const { settings } = useSettings();
  const [leaving, setLeaving] = useState(false);

  const duration = settings.splash.duration_ms || 2200;

  useEffect(() => {
    const outTimer = window.setTimeout(() => setLeaving(true), duration);
    const doneTimer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(SEEN_KEY, '1');
      } catch {
        /* ignore */
      }
      onDone();
    }, duration + 520);
    return () => {
      window.clearTimeout(outTimer);
      window.clearTimeout(doneTimer);
    };
  }, [duration, onDone]);

  const media = settings.splash;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden transition-opacity duration-500"
      style={{
        opacity: leaving ? 0 : 1,
        background:
          'radial-gradient(1200px 600px at 50% -10%, color-mix(in srgb, var(--sf-primary) 26%, transparent), transparent 60%), var(--sf-bg)',
      }}
    >
      {/* soft ambient rings */}
      <span
        aria-hidden
        className="absolute h-[26rem] w-[26rem] rounded-full animate-pulse-ring"
        style={{ border: '1px solid color-mix(in srgb, var(--sf-primary) 35%, transparent)' }}
      />
      <span
        aria-hidden
        className="absolute h-[34rem] w-[34rem] rounded-full animate-pulse-ring"
        style={{
          border: '1px solid color-mix(in srgb, var(--sf-accent) 28%, transparent)',
          animationDelay: '.6s',
        }}
      />

      <h1
        className="relative text-3xl font-extrabold tracking-[0.22em] text-content animate-fade-up sm:text-4xl"
        style={{ animationDelay: '80ms' }}
      >
        STAFFFLOW
      </h1>
      <p
        className="relative mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-content-muted animate-fade-up sm:text-sm"
        style={{ animationDelay: '260ms' }}
      >
        {localized(settings.branding.system_name_en, settings.branding.system_name_ar)}
      </p>

      {/* ---- replaceable media slot ---- */}
      <div
        className="relative mt-9 flex h-28 w-28 items-center justify-center animate-scale-in sm:h-32 sm:w-32"
        style={{ animationDelay: '420ms' }}
      >
        {media.media_type === 'video' && media.media_url ? (
          <video
            src={media.media_url}
            autoPlay
            muted
            playsInline
            className="h-full w-full rounded-theme-lg object-contain"
          />
        ) : media.media_url ? (
          <img src={media.media_url} alt="" className="h-full w-full object-contain" />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center rounded-theme-lg text-3xl font-extrabold text-primary-fg shadow-theme"
            style={{ background: 'linear-gradient(135deg, var(--sf-primary), var(--sf-accent))' }}
          >
            SF
          </span>
        )}
      </div>

      <div
        className="relative mt-9 flex flex-col items-center gap-3 animate-fade-in"
        style={{ animationDelay: '700ms' }}
      >
        <span className="h-1 w-40 overflow-hidden rounded-full bg-content-muted/20">
          <span
            className="block h-full rounded-full bg-primary"
            style={{ animation: `sf-load ${duration}ms cubic-bezier(.4,0,.2,1) forwards` }}
          />
        </span>
        <p className="text-xs font-medium text-content-muted">{t('splash.loading')}</p>
      </div>

      <p className="absolute bottom-8 px-6 text-center text-[11px] leading-relaxed text-content-muted">
        {t('splash.copyright')}
      </p>

      <style>{`@keyframes sf-load { from { width: 0 } to { width: 100% } }`}</style>
    </div>
  );
}

export function shouldShowSplash(enabled: boolean): boolean {
  if (!enabled) return false;
  try {
    return window.sessionStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}
