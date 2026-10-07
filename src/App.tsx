import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders } from '@/providers/AppProviders';
import { useSettings } from '@/providers/SettingsProvider';
import { useAuth } from '@/providers/AuthProvider';
import { SplashScreen, shouldShowSplash } from '@/features/splash/SplashScreen';
import { AppRoutes } from '@/routes';

function Shell() {
  const { settings } = useSettings();
  const { status } = useAuth();
  const [splashDone, setSplashDone] = useState(() => !shouldShowSplash(true));

  const showSplash = !splashDone && settings.splash.enabled;

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setSplashDone(true)} />}
      <div
        aria-hidden={showSplash}
        className={showSplash ? 'pointer-events-none opacity-0' : 'animate-fade-in'}
      >
        {status === 'loading' && showSplash ? null : <AppRoutes />}
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <Shell />
      </AppProviders>
    </BrowserRouter>
  );
}
