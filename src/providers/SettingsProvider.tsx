import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DEFAULT_SETTINGS, fetchSettings } from '@/services/settings.service';
import type { SystemSettingsMap } from '@/types/models';

interface SettingsContextValue {
  settings: SystemSettingsMap;
  isLoading: boolean;
  refetch: () => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  isLoading: false,
  refetch: () => undefined,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['system-settings'],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_SETTINGS,
  });

  return (
    <SettingsContext.Provider
      value={{ settings: data ?? DEFAULT_SETTINGS, isLoading, refetch: () => void refetch() }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
