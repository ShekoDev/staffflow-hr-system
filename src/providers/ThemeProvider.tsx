import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchThemes, FALLBACK_THEME } from '@/services/themes.service';
import type { ColorMode, Theme } from '@/types/models';

const THEME_KEY = 'staffflow.theme';
const MODE_KEY = 'staffflow.mode';

interface ThemeContextValue {
  themes: Theme[];
  theme: Theme;
  themeKey: string;
  setThemeKey: (key: string) => void;
  colorMode: ColorMode;
  setColorMode: (mode: ColorMode) => void;
  /** The mode actually painted right now — 'system' resolved to light/dark. */
  resolvedMode: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function applyTokens(theme: Theme, mode: 'light' | 'dark'): void {
  const tokens = mode === 'dark' ? theme.tokens_dark : theme.tokens_light;
  const root = document.documentElement;
  for (const [name, value] of Object.entries(tokens ?? {})) {
    root.style.setProperty(`--sf-${name}`, value);
  }
  root.setAttribute('data-mode', mode);
  root.setAttribute('data-theme', theme.key);
}

export function ThemeProvider({
  children,
  defaultThemeKey = 'modern-blue',
  defaultColorMode = 'system',
}: {
  children: ReactNode;
  defaultThemeKey?: string;
  defaultColorMode?: ColorMode;
}) {
  const { data: themes = [FALLBACK_THEME] } = useQuery({
    queryKey: ['themes'],
    queryFn: fetchThemes,
    staleTime: 10 * 60 * 1000,
  });

  const [themeKey, setThemeKeyState] = useState(() => readStored(THEME_KEY, defaultThemeKey));
  const [colorMode, setColorModeState] = useState<ColorMode>(
    () => readStored(MODE_KEY, defaultColorMode) as ColorMode,
  );
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const resolvedMode: 'light' | 'dark' =
    colorMode === 'system' ? (systemDark ? 'dark' : 'light') : colorMode;

  const theme = useMemo(
    () => themes.find((t) => t.key === themeKey) ?? themes[0] ?? FALLBACK_THEME,
    [themes, themeKey],
  );

  useEffect(() => {
    applyTokens(theme, resolvedMode);
  }, [theme, resolvedMode]);

  const setThemeKey = useCallback((key: string) => {
    setThemeKeyState(key);
    write(THEME_KEY, key);
  }, []);

  const setColorMode = useCallback((mode: ColorMode) => {
    setColorModeState(mode);
    write(MODE_KEY, mode);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ themes, theme, themeKey: theme.key, setThemeKey, colorMode, setColorMode, resolvedMode }),
    [themes, theme, setThemeKey, colorMode, setColorMode, resolvedMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
