import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Mail,
  Pencil,
  Phone,
  Power,
  UserCog,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { PERMISSIONS } from '@/lib/permissions';
import {
  fetchDirectReports,
  fetchEmployee,
  setEmploymentStatus,
} from '@/services/employees.service';
import { fetchEmployeeBadges } from '@/services/customization.service';
import { fetchMyRanking } from '@/services/dashboard.service';
import { PageHeader } from '@/components/common/PageHeader';
import { EmployeeAvatar, EmployeeIdentity, EmployeeName } from '@/components/common/EmployeeIdentity';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Pill } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullPageSpinner } from '@/components/ui/Spinner';
import { NotFoundPage } from '@/features/errors/ErrorPages';
import { EmployeeFormModal } from './EmployeeFormModal';
import { formatDate, formatPercent } from '@/lib/format';

export function EmployeeProfilePage({ selfView = false }: { selfView?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const { t, localized, language } = useI18n();
  const { profile, can, roleKey } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const employeeId = selfView ? profile?.employee?.id : id;

  const { data: employee, isLoading } = useQuery({
    queryKey: ['employee', employeeId],
    queryFn: () => fetchEmployee(employeeId as string),
    enabled: Boolean(employeeId),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['direct-reports', employeeId],
    queryFn: () => fetchDirectReports(employeeId as string),
    enabled: Boolean(employeeId),
  });

  const { data: badges = [] } = useQuery({
    queryKey: ['employee-badges', employeeId],
    queryFn: () => fetchEmployeeBadges(employeeId as string),
    enabled: Boolean(employeeId),
  });

  const { data: ranking } = useQuery({
    queryKey: ['my-ranking', employeeId],
    queryFn: () => fetchMyRanking(employeeId as string),
    enabled: Boolean(employeeId),
  });

  const statusMutation = useMutation({
    mutationFn: (next: 'active' | 'inactive') => setEmploymentStatus(employeeId as string, next),
    onSuccess: () => {
      toast.success(t('employees.updated'));
      void queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  if (isLoading) return <FullPageSpinner label={t('common.loading')} />;
  if (!employee) return <NotFoundPage />;

  const isSelf = employee.user_id === profile?.user.id;
  const canEdit = can(PERMISSIONS.employees.editAll) || can(PERMISSIONS.employees.editTeam);
  const context = {
    roleKey: isSelf ? roleKey : undefined,
    isEmployeeOfMonth: Boolean(ranking?.is_employee_of_month),
  };

  return (
    <>
      <PageHeader
        title={t('employees.profile')}
        actions={
          <div className="flex items-center gap-2">
            {!selfView && (
              <Link to="/employees">
                <Button variant="ghost" leftIcon={<ArrowLeft size={15} className="rtl:rotate-180" />}>
                  {t('common.back')}
                </Button>
              </Link>
            )}
            {canEdit && (
              <Button leftIcon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>
                {t('common.edit')}
              </Button>
            )}
            {can(PERMISSIONS.employees.delete) && (
              <Button
                variant="secondary"
                leftIcon={<Power size={15} />}
                loading={statusMutation.isPending}
                onClick={() =>
                  statusMutation.mutate(employee.employment_status === 'active' ? 'inactive' : 'active')
                }
              >
                {employee.employment_status === 'active'
                  ? t('employees.deactivate')
                  : t('employees.activate')}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center">
            <EmployeeAvatar employee={employee} size="xl" context={context} />
            <div className="mt-4 w-full">
              <EmployeeName employee={employee} context={context} className="items-center" />
              <p className="mt-1 text-sm text-content-muted">{employee.job_title || '—'}</p>
              <p className="mt-0.5 text-xs text-content-muted">{employee.employee_code}</p>
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5">
              <Pill tone={employee.employment_status === 'active' ? 'success' : 'neutral'}>
                {employee.employment_status === 'active' ? t('common.active') : t('common.inactive')}
              </Pill>
              {employee.gender && (
                <Pill tone="primary">
                  {employee.gender === 'male' ? t('common.male') : t('common.female')}
                </Pill>
              )}
              {ranking?.is_employee_of_month && (
                <Pill tone="warning">🏆 {t('dashboard.employeeOfTheMonth')}</Pill>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-line pt-5">
            <InfoRow icon={<Mail size={15} />} label={t('auth.email')} value={employee.email} />
            <InfoRow icon={<Phone size={15} />} label={t('employees.phone')} value={employee.phone} dir="ltr" />
            <InfoRow
              icon={<Building2 size={15} />}
              label={t('employees.department')}
              value={localized(employee.department?.name_en, employee.department?.name_ar)}
            />
            <InfoRow
              icon={<UserCog size={15} />}
              label={t('employees.manager')}
              value={localized(employee.manager?.full_name_en, employee.manager?.full_name_ar)}
            />
            <InfoRow
              icon={<CalendarDays size={15} />}
              label={t('employees.joiningDate')}
              value={formatDate(employee.joining_date, language)}
            />
          </div>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          {ranking && (
            <Card>
              <CardHeader title={t('ranking.title')} subtitle={t('ranking.subtitle')} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <ScoreTile label={t('ranking.rank')} value={ranking.rank ? `#${ranking.rank}` : '—'} />
                <ScoreTile label={t('ranking.attendance')} value={formatPercent(ranking.attendance_score, language)} />
                <ScoreTile label={t('ranking.punctuality')} value={formatPercent(ranking.punctuality_score, language)} />
                <ScoreTile label={t('ranking.score')} value={formatPercent(ranking.final_score, language)} highlight />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={t('employees.badges')} />
            {badges.length === 0 ? (
              <p className="text-sm text-content-muted">{t('employees.noBadges')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.map((item) => (
                  <span
                    key={item.id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                    style={{
                      background: `color-mix(in srgb, ${item.badge?.color ?? 'var(--sf-primary)'} 14%, transparent)`,
                      color: item.badge?.color ?? 'var(--sf-primary)',
                    }}
                  >
                    <span aria-hidden>{item.badge?.icon}</span>
                    {localized(item.badge?.name_en, item.badge?.name_ar)}
                  </span>
                ))}
              </div>
            )}
          </Card>

          <Card padded={false}>
            <div className="p-4 sm:p-5">
              <CardHeader title={t('employees.directReports')} className="mb-0" />
            </div>
            {reports.length === 0 ? (
              <EmptyState title={t('employees.noDirectReports')} />
            ) : (
              <ul className="divide-y divide-line">
                {reports.map((member) => (
                  <li key={member.id} className="px-4 py-3 sm:px-5">
                    <Link to={`/employees/${member.id}`} className="block">
                      <EmployeeIdentity employee={member} subtitle={member.job_title} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {employee.notes && (
            <Card>
              <CardHeader title={t('common.notes')} />
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-content-muted">
                {employee.notes}
              </p>
            </Card>
          )}
        </div>
      </div>

      <EmployeeFormModal open={editOpen} employee={employee} onClose={() => setEditOpen(false)} />
    </>
  );
}

function InfoRow({
  icon,
  label,
  value,
  dir,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-theme-sm bg-surface-alt text-content-muted">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">{label}</p>
        <p className="truncate text-sm font-medium text-content" dir={dir}>
          {value || '—'}
        </p>
      </div>
    </div>
  );
}

function ScoreTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="rounded-theme-sm border border-line p-3 text-center"
      style={highlight ? { background: 'color-mix(in srgb, var(--sf-primary) 8%, transparent)' } : undefined}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-content-muted">{label}</p>
      <p className="mt-1 text-lg font-extrabold text-content">{value}</p>
    </div>
  );
}
