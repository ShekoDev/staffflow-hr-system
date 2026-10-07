import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AlertTriangle, Lock, Mail } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { getRememberedEmail, signIn } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input, Switch } from '@/components/ui/Field';
import { BrandMark } from '@/components/layout/Sidebar';
import { LanguageSwitcher, ColorModeToggle } from '@/components/common/AppearanceControls';
import { AuthShell } from './AuthShell';

export function LoginPage() {
  const { t } = useI18n();
  const { status, configured, refresh } = useAuth();
  const { settings } = useSettings();

  const [email, setEmail] = useState(getRememberedEmail);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(getRememberedEmail()));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'authenticated') return <Navigate to="/" replace />;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn({ email, password, rememberMe: remember });
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(/invalid|credential/i.test(message) ? t('auth.invalidCredentials') : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="mb-7 flex items-center justify-between">
        <BrandMark logoUrl={settings.branding.logo_url} size={44} />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <ColorModeToggle />
        </div>
      </div>

      <h1 className="text-2xl font-extrabold tracking-tight text-content">{t('auth.welcomeBack')}</h1>
      <p className="mt-1 text-sm text-content-muted">{t('auth.loginSubtitle')}</p>

      {!configured && (
        <div className="mt-5 flex gap-3 rounded-theme-sm border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" />
          <div>
            <p className="text-sm font-semibold text-content">{t('auth.notConfigured')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-content-muted">
              {t('auth.notConfiguredBody')}
            </p>
          </div>
        </div>
      )}

      {status === 'inactive' && (
        <p className="mt-5 rounded-theme-sm border border-danger/40 bg-danger/10 p-3 text-sm text-danger">
          {t('auth.accountInactive')}
        </p>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Input
          type="email"
          label={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          icon={<Mail size={16} />}
          autoComplete="username"
          required
        />
        <Input
          type="password"
          label={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          icon={<Lock size={16} />}
          autoComplete="current-password"
          required
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Switch checked={remember} onChange={setRemember} label={t('auth.rememberMe')} />
          <Link
            to="/forgot-password"
            className="text-xs font-semibold text-primary transition hover:underline"
          >
            {t('auth.forgotPassword')}
          </Link>
        </div>

        {error && (
          <p className="rounded-theme-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <Button type="submit" fullWidth size="lg" loading={busy} disabled={!configured}>
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </Button>
      </form>
    </AuthShell>
  );
}
