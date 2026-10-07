import { useEffect, useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from '@/i18n';
import { SettingsProvider, useSettings } from './SettingsProvider';
import { ThemeProvider } from './ThemeProvider';
import { ToastProvider } from './ToastProvider';
import { AuthProvider, useAuth } from './AuthProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

/**
 * Applies the administrator's defaults, then lets a user preference win
 * once their profile has loaded.
 */
function PreferenceBridge({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const { profile } = useAuth();
  const [key, setKey] = useState(0);

  useEffect(() => {
    // Remount the theme tree once when the user's stored preference arrives.
    if (profile?.user.preferred_theme) setKey((k) => k + 1);
  }, [profile?.user.preferred_theme]);

  return (
    <ThemeProvider
      key={key}
      defaultThemeKey={profile?.user.preferred_theme ?? settings.appearance.default_theme}
      defaultColorMode={profile?.user.color_mode ?? settings.appearance.default_color_mode}
    >
      {children}
    </ThemeProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider defaultLanguage="en">
        <AuthProvider>
          <SettingsProvider>
            <PreferenceBridge>
              <ToastProvider>{children}</ToastProvider>
            </PreferenceBridge>
          </SettingsProvider>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
