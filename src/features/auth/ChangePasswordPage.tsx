import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import { useI18n } from '@/i18n';
import { updatePassword } from '@/services/auth.service';
import { useToast } from '@/providers/ToastProvider';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/common/PageHeader';
import { AuthShell } from './AuthShell';

function PasswordForm({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    setBusy(true);
    try {
      await updatePassword(password);
      toast.success(t('auth.passwordChanged'));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        type="password"
        label={t('auth.newPassword')}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        icon={<KeyRound size={16} />}
        autoComplete="new-password"
        required
      />
      <Input
        type="password"
        label={t('auth.confirmPassword')}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        icon={<KeyRound size={16} />}
        autoComplete="new-password"
        required
      />
      {error && (
        <p className="rounded-theme-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" loading={busy}>
        {t('auth.changePassword')}
      </Button>
    </form>
  );
}

/** In-app screen, reachable from the account menu. */
export function ChangePasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title={t('auth.changePassword')} />
      <Card className="max-w-md">
        <PasswordForm onDone={() => navigate('/')} />
      </Card>
    </>
  );
}

/** Landing page for the emailed reset link. */
export function ResetPasswordPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { status } = useAuth();

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold text-content">{t('auth.resetPassword')}</h1>
      <p className="mt-1 mb-6 text-sm text-content-muted">
        {status === 'unauthenticated' ? t('auth.resetLinkSent') : t('auth.loginSubtitle')}
      </p>
      <PasswordForm onDone={() => navigate('/')} />
    </AuthShell>
  );
}
