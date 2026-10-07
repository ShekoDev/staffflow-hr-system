import { useQuery } from '@tanstack/react-query';
import { Award, Bell, Building2, ClipboardCheck, Trophy, UserCog } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { fetchMyRanking, fetchNotifications } from '@/services/dashboard.service';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/common/PageHeader';
import { EmployeeAvatar } from '@/components/common/EmployeeIdentity';
import { ProgressBar } from '@/components/ui/Progress';
import { Pill } from '@/components/ui/Badge';
import { formatDateTime, formatPercent, greetingKey } from '@/lib/format';

export function EmployeeDashboard() {
  const { t, localized, language } = useI18n();
  const { profile, roleKey } = useAuth();
  const employee = profile?.employee;

  const { data: ranking } = useQuery({
    queryKey: ['my-ranking', employee?.id],
    queryFn: () => fetchMyRanking(employee?.id as string),
    enabled: Boolean(employee?.id),
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetchNotifications(6),
  });

  const greeting = t(`dashboard.${greetingKey()}` as 'dashboard.goodMorning');
  const displayName = localized(employee?.full_name_en, employee?.full_name_ar);
  const isEmployeeOfMonth = Boolean(ranking?.is_employee_of_month);

  return (
    <>
      <PageHeader
        title={`${greeting}${displayName ? `, ${displayName}` : ''}`}
        subtitle={employee?.job_title ?? undefined}
      />

      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-wrap items-center gap-5">
          <EmployeeAvatar
            employee={employee}
            size="xl"
            context={{ roleKey, isEmployeeOfMonth }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold text-content">{displayName || '—'}</h2>
              {isEmployeeOfMonth && (
                <Pill tone="warning" icon={<Trophy size={12} />}>
                  {t('dashboard.employeeOfTheMonth')}
                </Pill>
              )}
            </div>
            <p className="mt-0.5 text-sm text-content-muted">
              {employee?.employee_code} · {employee?.job_title ?? '—'}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-xs text-content-muted">
              <span className="flex items-center gap-1.5">
                <Building2 size={13} />
                {t('dashboard.myDepartment')}:{' '}
                <strong className="text-content">
                  {localized(employee?.department?.name_en, employee?.department?.name_ar) ||
                    t('common.notAssigned')}
                </strong>
              </span>
              <span className="flex items-center gap-1.5">
                <UserCog size={13} />
                {t('dashboard.myManager')}:{' '}
                <strong className="text-content">
                  {localized(employee?.manager?.full_name_en, employee?.manager?.full_name_ar) ||
                    t('common.notAssigned')}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label={t('dashboard.myAttendance')}
          value={ranking ? formatPercent(ranking.attendance_score, language) : '—'}
          icon={<ClipboardCheck size={18} />}
          tone="success"
        />
        <StatCard
          label={t('ranking.punctuality')}
          value={ranking ? formatPercent(ranking.punctuality_score, language) : '—'}
          icon={<Award size={18} />}
          tone="accent"
          delay={60}
        />
        <StatCard
          label={t('dashboard.myEvaluation')}
          value={ranking ? formatPercent(ranking.evaluation_score, language) : '—'}
          icon={<ClipboardCheck size={18} />}
          delay={120}
        />
        <StatCard
          label={t('dashboard.myRanking')}
          value={ranking?.rank ? `#${ranking.rank}` : '—'}
          icon={<Trophy size={18} />}
          tone="warning"
          delay={180}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('dashboard.myEvaluation')} />
          {ranking ? (
            <div className="space-y-3">
              <Metric label={t('ranking.attendance')} value={ranking.attendance_score} language={language} />
              <Metric label={t('ranking.punctuality')} value={ranking.punctuality_score} language={language} />
              <Metric label={t('ranking.evaluation')} value={ranking.evaluation_score} language={language} />
              <div className="border-t border-line pt-3">
                <Metric
                  label={t('ranking.score')}
                  value={ranking.final_score}
                  language={language}
                  color="var(--sf-success)"
                />
              </div>
            </div>
          ) : (
            <EmptyState title={t('ranking.noRanking')} description={t('ranking.noRankingBody')} />
          )}
        </Card>

        <Card padded={false}>
          <div className="p-4 sm:p-5">
            <CardHeader title={t('dashboard.notifications')} className="mb-0" />
          </div>
          {notifications.length === 0 ? (
            <EmptyState icon={<Bell size={22} />} title={t('dashboard.noNotifications')} />
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((item) => (
                <li key={item.id} className="px-4 py-3 sm:px-5">
                  <p className="text-sm font-semibold text-content">
                    {localized(item.title_en, item.title_ar)}
                  </p>
                  {(item.body_en || item.body_ar) && (
                    <p className="mt-0.5 text-xs text-content-muted">
                      {localized(item.body_en, item.body_ar)}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-content-muted">
                    {formatDateTime(item.created_at, language)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  language,
  color,
}: {
  label: string;
  value: number;
  language: 'en' | 'ar';
  color?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-content-muted">{label}</span>
        <span className="text-sm font-bold text-content">{formatPercent(value, language)}</span>
      </div>
      <ProgressBar value={value} color={color} />
    </div>
  );
}
