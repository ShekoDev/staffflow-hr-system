import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import { useI18n } from '@/i18n';
import { requestPasswordReset } from '@/services/auth.service';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { AuthShell } from './AuthShell';

export function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold text-content">{t('auth.resetPassword')}</h1>
      <p className="mt-1 text-sm text-content-muted">{t('auth.loginSubtitle')}</p>

      {sent ? (
        <p className="mt-6 rounded-theme-sm border border-success/40 bg-success/10 p-3 text-sm text-content">
          {t('auth.resetLinkSent')}
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input
            type="email"
            label={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail size={16} />}
            required
          />
          {error && (
            <p className="rounded-theme-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" fullWidth size="lg" loading={busy}>
            {t('auth.sendResetLink')}
          </Button>
        </form>
      )}

      <Link
        to="/login"
        className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft size={15} className="rtl:rotate-180" />
        {t('auth.backToLogin')}
      </Link>
    </AuthShell>
  );
}
