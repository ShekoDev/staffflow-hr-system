import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { SearchX, ShieldAlert } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/Button';

function Shell({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center animate-fade-up">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 text-danger">
        {icon}
      </div>
      <h1 className="text-2xl font-extrabold text-content">{title}</h1>
      <p className="mt-2 max-w-md text-sm text-content-muted">{body}</p>
      <Link to="/" className="mt-6">
        <Button>{t('errors.goHome')}</Button>
      </Link>
    </div>
  );
}

export function NotFoundPage() {
  const { t } = useI18n();
  return <Shell icon={<SearchX size={28} />} title={t('errors.notFound')} body={t('errors.notFoundBody')} />;
}

export function ForbiddenPage() {
  const { t } = useI18n();
  return (
    <Shell icon={<ShieldAlert size={28} />} title={t('errors.forbidden')} body={t('errors.forbiddenBody')} />
  );
}
