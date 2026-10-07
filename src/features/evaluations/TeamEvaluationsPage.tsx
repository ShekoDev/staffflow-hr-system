import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCheck, ClipboardList } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { PERMISSIONS } from '@/lib/permissions';
import { fetchDirectReports, fetchEmployees } from '@/services/employees.service';
import {
  approveEvaluation,
  fetchDefaultTemplate,
  fetchEvaluations,
} from '@/services/evaluations.service';
import { PageHeader } from '@/components/common/PageHeader';
import { EmployeeIdentity } from '@/components/common/EmployeeIdentity';
import { PermissionGate } from '@/components/common/PermissionGate';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { DataTable, type Column } from '@/components/ui/Table';
import { Pill, type BadgeTone } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatPercent, monthName } from '@/lib/format';
import { EvaluationFormModal, type EvaluationTarget } from './EvaluationForm';
import type { Employee, EvaluationStage, EvaluationStatus } from '@/types/models';

const STATUS_TONE: Record<EvaluationStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export function TeamEvaluationsPage() {
  const { t, language } = useI18n();
  const { profile, can } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [stage, setStage] = useState<EvaluationStage>('manager');
  const [target, setTarget] = useState<EvaluationTarget | null>(null);

  const seesEveryone = can(PERMISSIONS.evaluations.viewAll) || can(PERMISSIONS.employees.viewAll);
  const myEmployeeId = profile?.employee?.id;

  const { data: template } = useQuery({
    queryKey: ['evaluation-template'],
    queryFn: fetchDefaultTemplate,
  });

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['evaluation-people', seesEveryone, myEmployeeId],
    queryFn: async (): Promise<Employee[]> => {
      if (seesEveryone) {
        const page = await fetchEmployees({ pageSize: 300, status: 'active' });
        return page.rows;
      }
      if (!myEmployeeId) return [];
      return fetchDirectReports(myEmployeeId);
    },
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ['evaluations', year, month, stage],
    queryFn: () => fetchEvaluations({ year, month, stage }),
  });

  const byEmployee = useMemo(
    () => new Map(evaluations.map((row) => [row.employee_id, row])),
    [evaluations],
  );

  const approveMutation = useMutation({
    mutationFn: (id: string) => approveEvaluation(id),
    onSuccess: () => {
      toast.success(t('evaluations.approved'));
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const stageLabel = (value: EvaluationStage) =>
    ({
      manager: t('evaluations.stageManager'),
      administrative: t('evaluations.stageAdministrative'),
      self: t('evaluations.stageSelf'),
      peer: t('evaluations.stagePeer'),
    })[value];

  const statusLabel = (value: EvaluationStatus) =>
    ({
      draft: t('evaluations.draft'),
      submitted: t('evaluations.statusSubmitted'),
      approved: t('evaluations.statusApproved'),
      rejected: t('evaluations.statusRejected'),
    })[value];

  const columns: Column<Employee>[] = [
    {
      key: 'employee',
      header: t('employees.title'),
      render: (row) => (
        <EmployeeIdentity employee={row} subtitle={row.job_title} size="xs" />
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => {
        const evaluation = byEmployee.get(row.id);
        return evaluation ? (
          <Pill tone={STATUS_TONE[evaluation.status]}>{statusLabel(evaluation.status)}</Pill>
        ) : (
          <Pill tone="neutral">{t('evaluations.notEvaluated')}</Pill>
        );
      },
    },
    {
      key: 'score',
      header: t('evaluations.score'),
      render: (row) => {
        const evaluation = byEmployee.get(row.id);
        return evaluation?.percentage != null ? (
          <span className="text-sm font-bold text-content">
            {formatPercent(Number(evaluation.percentage), language)}
          </span>
        ) : (
          <span className="text-sm text-content-muted">—</span>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      className: 'text-end',
      render: (row) => {
        const evaluation = byEmployee.get(row.id);
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              variant="secondary"
              onClick={() =>
                setTarget({
                  employee: row,
                  evaluationId: evaluation?.id,
                  comments: evaluation?.comments,
                })
              }
            >
              {evaluation ? t('common.edit') : t('evaluations.evaluate')}
            </Button>
            {evaluation && evaluation.status === 'submitted' && (
              <PermissionGate permission={PERMISSIONS.evaluations.manage}>
                <Button
                  size="sm"
                  leftIcon={<CheckCircle2 size={14} />}
                  loading={approveMutation.isPending}
                  onClick={() => approveMutation.mutate(evaluation.id)}
                >
                  {t('evaluations.approve')}
                </Button>
              </PermissionGate>
            )}
          </div>
        );
      },
    },
  ];

  const pending = people.filter((person) => !byEmployee.has(person.id)).length;

  return (
    <>
      <PageHeader
        title={t('evaluations.evaluateTeam')}
        subtitle={t('evaluations.evaluateSubtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={stage}
              onChange={(e) => setStage(e.target.value as EvaluationStage)}
              className="h-10 w-44 py-0 text-sm"
            >
              {(['manager', 'administrative', 'peer'] as EvaluationStage[]).map((value) => (
                <option key={value} value={value}>
                  {stageLabel(value)}
                </option>
              ))}
            </Select>
            <Select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-10 w-36 py-0 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthName(m, language)}
                </option>
              ))}
            </Select>
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-10 w-28 py-0 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {pending > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-theme-sm border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-content">
          <ClipboardList size={16} className="text-warning" />
          {t('evaluations.pendingEvaluations')}: <strong>{pending}</strong>
        </div>
      )}

      {isLoading ? (
        <Card>
          <SkeletonTable rows={6} cols={4} />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={people}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState
              icon={<ClipboardCheck size={24} />}
              title={t('employees.noDirectReports')}
              description={t('evaluations.noEvaluationsBody')}
            />
          }
        />
      )}

      <EvaluationFormModal
        target={target}
        stage={stage}
        templateId={template?.id ?? null}
        year={year}
        month={month}
        onClose={() => setTarget(null)}
      />
    </>
  );
}
