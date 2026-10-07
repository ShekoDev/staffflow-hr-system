import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { en } from './locales/en';
import { ar } from './locales/ar';
import type { Dictionary, TranslationKey } from './dictionary';
import type { Language } from '@/types/models';

const DICTIONARIES: Record<Language, Dictionary> = {
  en: en as unknown as Dictionary,
  ar,
};

const STORAGE_KEY = 'staffflow.language';

export interface I18nContextValue {
  language: Language;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  /** Picks the Arabic field when the UI is Arabic and the value exists. */
  localized: (en: string | null | undefined, ar: string | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLanguage(fallback: Language): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'ar') return stored;
  } catch {
    /* storage unavailable — fall through */
  }
  return fallback;
}

export function I18nProvider({
  children,
  defaultLanguage = 'en',
}: {
  children: ReactNode;
  defaultLanguage?: Language;
}) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage(defaultLanguage));

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const dir = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    const root = document.documentElement;
    root.lang = language;
    root.dir = dir;
    root.classList.toggle('font-arabic', language === 'ar');
  }, [language, dir]);

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const [section, entry] = key.split('.') as [keyof Dictionary, string];
      const dict = DICTIONARIES[language] ?? DICTIONARIES.en;
      const table = dict[section] as Record<string, string> | undefined;
      const fallbackTable = (DICTIONARIES.en[section] ?? {}) as Record<string, string>;
      let value = table?.[entry] ?? fallbackTable[entry] ?? key;
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replace(new RegExp(`\\{${name}\\}`, 'g'), String(replacement));
        }
      }
      return value;
    },
    [language],
  );

  const localized = useCallback(
    (enValue: string | null | undefined, arValue: string | null | undefined) => {
      if (language === 'ar') return arValue || enValue || '';
      return enValue || arValue || '';
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, dir, isRtl: dir === 'rtl', setLanguage, t, localized }),
    [language, dir, setLanguage, t, localized],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}

export type { TranslationKey };
