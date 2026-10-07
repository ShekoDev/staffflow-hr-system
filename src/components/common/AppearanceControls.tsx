import { useState } from 'react';
import { Check, Languages, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useI18n } from '@/i18n';
import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { updateOwnPreferences } from '@/services/users.service';
import type { ColorMode, Language } from '@/types/models';
import { Button } from '@/components/ui/Button';

/** العربية | English switcher. */
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage } = useI18n();
  const { profile } = useAuth();
  const { settings } = useSettings();

  if (!settings.appearance.allow_user_language && profile?.roleKey !== 'admin') return null;

  const change = (next: Language) => {
    setLanguage(next);
    if (profile) void updateOwnPreferences(profile.user.id, { preferred_language: next });
  };

  if (compact) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={() => change(language === 'ar' ? 'en' : 'ar')}
        aria-label="Switch language"
        title={language === 'ar' ? 'English' : 'العربية'}
      >
        <Languages size={17} />
      </Button>
    );
  }

  return (
    <div className="inline-flex items-center overflow-hidden rounded-theme-sm border border-line bg-surface-alt p-0.5 text-xs font-bold">
      {(['ar', 'en'] as Language[]).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => change(code)}
          className={cn(
            'rounded-[calc(var(--sf-radius)*0.45)] px-3 py-1.5 transition',
            language === code ? 'bg-surface text-primary shadow-sm' : 'text-content-muted hover:text-content',
          )}
        >
          {code === 'ar' ? 'العربية' : 'English'}
        </button>
      ))}
    </div>
  );
}

/** Light / Dark / System. */
export function ColorModeToggle() {
  const { colorMode, setColorMode } = useTheme();
  const { profile } = useAuth();
  const { t } = useI18n();

  const options: { mode: ColorMode; icon: typeof Sun; label: string }[] = [
    { mode: 'light', icon: Sun, label: t('theme.light') },
    { mode: 'dark', icon: Moon, label: t('theme.dark') },
    { mode: 'system', icon: Monitor, label: t('theme.system') },
  ];

  const change = (mode: ColorMode) => {
    setColorMode(mode);
    if (profile) void updateOwnPreferences(profile.user.id, { color_mode: mode });
  };

  return (
    <div className="inline-flex items-center rounded-theme-sm border border-line bg-surface-alt p-0.5">
      {options.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          title={label}
          aria-label={label}
          onClick={() => change(mode)}
          className={cn(
            'rounded-[calc(var(--sf-radius)*0.45)] p-1.5 transition',
            colorMode === mode ? 'bg-surface text-primary shadow-sm' : 'text-content-muted hover:text-content',
          )}
        >
          <Icon size={15} />
        </button>
      ))}
    </div>
  );
}

/** Theme picker — reads the list straight from the `themes` table. */
export function ThemePicker() {
  const { themes, themeKey, setThemeKey } = useTheme();
  const { localized, t } = useI18n();
  const { profile } = useAuth();
  const { settings } = useSettings();
  const [open, setOpen] = useState(false);

  if (!settings.appearance.allow_user_theme && profile?.roleKey !== 'admin') return null;

  const change = (key: string) => {
    setThemeKey(key);
    setOpen(false);
    if (profile) void updateOwnPreferences(profile.user.id, { preferred_theme: key });
  };

  return (
    <div className="relative">
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label={t('theme.chooseTheme')}>
        <Palette size={17} />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="sf-surface absolute end-0 z-50 mt-2 w-60 animate-scale-in p-2">
            <p className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wide text-content-muted">
              {t('theme.chooseTheme')}
            </p>
            <div className="space-y-0.5">
              {themes.map((theme) => (
                <button
                  key={theme.key}
                  type="button"
                  onClick={() => change(theme.key)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-theme-sm px-2 py-2 text-start text-sm transition',
                    theme.key === themeKey ? 'bg-primary/10 text-primary' : 'hover:bg-surface-alt',
                  )}
                >
                  <span className="flex gap-1">
                    {['primary', 'accent', 'surface'].map((token) => (
                      <span
                        key={token}
                        className="h-4 w-4 rounded-full border border-line"
                        style={{ background: theme.tokens_light?.[token] ?? '#ccc' }}
                      />
                    ))}
                  </span>
                  <span className="flex-1 truncate font-medium">
                    {localized(theme.name_en, theme.name_ar)}
                  </span>
                  {theme.key === themeKey && <Check size={15} />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
