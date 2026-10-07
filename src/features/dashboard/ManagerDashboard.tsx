import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Trophy, UserCheck, Users } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { fetchDirectReports } from '@/services/employees.service';
import { fetchMonthlyRanking } from '@/services/dashboard.service';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmployeeIdentity } from '@/components/common/EmployeeIdentity';
import { PageHeader } from '@/components/common/PageHeader';
import { Pill } from '@/components/ui/Badge';
import { formatPercent, greetingKey } from '@/lib/format';

export function ManagerDashboard() {
  const { t, localized, language } = useI18n();
  const { profile } = useAuth();
  const employeeId = profile?.employee?.id;
  const now = new Date();

  const { data: team = [], isLoading } = useQuery({
    queryKey: ['direct-reports', employeeId],
    queryFn: () => fetchDirectReports(employeeId as string),
    enabled: Boolean(employeeId),
  });

  const { data: ranking = [] } = useQuery({
    queryKey: ['ranking', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => fetchMonthlyRanking(now.getFullYear(), now.getMonth() + 1),
  });

  const teamIds = new Set(team.map((member) => member.id));
  const teamRanking = ranking.filter((row) => teamIds.has(row.employee_id));
  const activeCount = team.filter((member) => member.employment_status === 'active').length;
  const averageScore = teamRanking.length
    ? teamRanking.reduce((sum, row) => sum + row.final_score, 0) / teamRanking.length
    : 0;

  const greeting = t(`dashboard.${greetingKey()}` as 'dashboard.goodMorning');
  const displayName = localized(profile?.employee?.full_name_en, profile?.employee?.full_name_ar);

  if (isLoading) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <SkeletonCards />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${greeting}${displayName ? `, ${displayName}` : ''}`}
        subtitle={t('dashboard.myTeam')}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={t('dashboard.myTeam')} value={team.length} icon={<Users size={18} />} />
        <StatCard label={t('common.active')} value={activeCount} icon={<UserCheck size={18} />} tone="success" delay={60} />
        <StatCard
          label={t('dashboard.teamPerformance')}
          value={formatPercent(Math.round(averageScore * 10) / 10, language)}
          icon={<ClipboardCheck size={18} />}
          tone="accent"
          delay={120}
        />
        <StatCard
          label={t('dashboard.teamRanking')}
          value={teamRanking.length ? `#${teamRanking[0]?.rank ?? '—'}` : '—'}
          icon={<Trophy size={18} />}
          tone="warning"
          delay={180}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card padded={false}>
          <div className="p-4 sm:p-5">
            <CardHeader
              title={t('dashboard.myTeam')}
              action={
                <Link to="/employees" className="text-xs font-semibold text-primary hover:underline">
                  {t('nav.allEmployees')}
                </Link>
              }
              className="mb-0"
            />
          </div>
          {team.length === 0 ? (
            <EmptyState title={t('employees.noDirectReports')} />
          ) : (
            <ul className="divide-y divide-line">
              {team.slice(0, 8).map((member) => (
                <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <EmployeeIdentity employee={member} subtitle={member.job_title} />
                  <Pill tone={member.employment_status === 'active' ? 'success' : 'neutral'}>
                    {member.employment_status === 'active' ? t('common.active') : t('common.inactive')}
                  </Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card padded={false}>
          <div className="p-4 sm:p-5">
            <CardHeader title={t('dashboard.teamRanking')} className="mb-0" />
          </div>
          {teamRanking.length === 0 ? (
            <EmptyState
              icon={<Trophy size={22} />}
              title={t('ranking.noRanking')}
              description={t('ranking.noRankingBody')}
            />
          ) : (
            <ul className="divide-y divide-line">
              {teamRanking.slice(0, 8).map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="w-7 shrink-0 text-center text-sm font-extrabold text-content-muted">
                    {row.rank}
                  </span>
                  <EmployeeIdentity
                    employee={{
                      id: row.employee_id,
                      full_name_en: row.full_name_en ?? null,
                      full_name_ar: row.full_name_ar ?? null,
                      photo_url: row.photo_url ?? null,
                      frame_id: row.frame_id ?? null,
                      name_color: row.name_color ?? null,
                    }}
                    context={{ isEmployeeOfMonth: row.is_employee_of_month }}
                  />
                  <span className="ms-auto text-sm font-bold text-content">
                    {formatPercent(row.final_score, language)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
