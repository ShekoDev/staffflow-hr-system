import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { useI18n } from '@/i18n';
import { fetchAuditLogs } from '@/services/audit.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/Table';
import { Pill } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { formatDateTime } from '@/lib/format';
import type { AuditLog } from '@/types/models';

const ACTION_TONE: Record<string, 'success' | 'primary' | 'danger' | 'warning' | 'neutral'> = {
  create: 'success',
  update: 'primary',
  delete: 'danger',
  export: 'warning',
  permission_change: 'warning',
  role_change: 'warning',
};

export function AuditLogsPage() {
  const { t, language } = useI18n();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => fetchAuditLogs(100),
  });

  const columns: Column<AuditLog>[] = [
    {
      key: 'actor',
      header: t('users.user'),
      render: (row) => (
        <span className="text-sm font-medium text-content">{row.actor_name ?? '—'}</span>
      ),
    },
    {
      key: 'action',
      header: t('common.actions'),
      render: (row) => (
        <Pill tone={ACTION_TONE[row.action] ?? 'neutral'}>{row.action}</Pill>
      ),
    },
    {
      key: 'entity',
      header: t('common.status'),
      hideOnMobile: true,
      render: (row) => <span className="text-sm text-content-muted">{row.entity_type}</span>,
    },
    {
      key: 'target',
      header: t('employees.title'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-content-muted">{row.target_label ?? '—'}</span>
      ),
    },
    {
      key: 'when',
      header: t('common.date'),
      render: (row) => (
        <span className="text-xs text-content-muted">{formatDateTime(row.created_at, language)}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('nav.auditLogs')} />
      {isLoading ? (
        <Card>
          <SkeletonTable />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={logs}
          rowKey={(row) => row.id}
          emptyState={<EmptyState icon={<Activity size={24} />} title={t('common.noResults')} />}
        />
      )}
    </>
  );
}
