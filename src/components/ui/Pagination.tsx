import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';
import { useI18n } from '@/i18n';

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const { t, isRtl } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const Prev = isRtl ? ChevronRight : ChevronLeft;
  const Next = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-content-muted">
        {total} {t('common.results')}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          leftIcon={<Prev size={14} />}
        >
          {t('common.previous')}
        </Button>
        <span className="px-1 text-xs font-semibold text-content-muted">
          {page} {t('common.of')} {pages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          rightIcon={<Next size={14} />}
        >
          {t('common.next')}
        </Button>
      </div>
    </div>
  );
}
