import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarCheck,
  CalendarX,
  ClipboardCheck,
  Clock,
  Plane,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { fetchAdminStats, fetchEmployeeOfTheMonth } from '@/services/dashboard.service';
import { StatCard } from '@/components/common/StatCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { SkeletonCards } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmployeeAvatar, EmployeeName } from '@/components/common/EmployeeIdentity';
import { ProgressBar } from '@/components/ui/Progress';
import { formatPercent, greetingKey } from '@/lib/format';
import { PageHeader } from '@/components/common/PageHeader';

export function AdminDashboard() {
  const { t, localized, language } = useI18n();
  const { profile } = useAuth();

  const { data: stats, isLoading } = useQuery({ queryKey: ['admin-stats'], queryFn: fetchAdminStats });
  const { data: eom } = useQuery({ queryKey: ['employee-of-month'], queryFn: fetchEmployeeOfTheMonth });

  const greeting = t(`dashboard.${greetingKey()}` as 'dashboard.goodMorning');
  const displayName =
    localized(profile?.employee?.full_name_en, profile?.employee?.full_name_ar) ||
    profile?.user.username ||
    '';

  if (isLoading || !stats) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <SkeletonCards count={8} />
      </>
    );
  }

  const departmentData = stats.departments
    .filter((d) => d.headcount > 0)
    .map((d) => ({ name: localized(d.name_en, d.name_ar), value: d.headcount }));

  const genderData = [
    { name: t('common.male'), value: stats.maleEmployees, color: 'var(--sf-primary)' },
    { name: t('common.female'), value: stats.femaleEmployees, color: 'var(--sf-accent)' },
  ].filter((d) => d.value > 0);

  return (
    <>
      <PageHeader
        title={`${greeting}${displayName ? `, ${displayName}` : ''}`}
        subtitle={t('dashboard.title')}
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={t('dashboard.totalEmployees')} value={stats.totalEmployees} icon={<Users size={18} />} delay={0} />
        <StatCard label={t('dashboard.activeEmployees')} value={stats.activeEmployees} icon={<UserCheck size={18} />} tone="success" delay={50} />
        <StatCard label={t('dashboard.maleEmployees')} value={stats.maleEmployees} icon={<Users size={18} />} tone="accent" delay={100} />
        <StatCard label={t('dashboard.femaleEmployees')} value={stats.femaleEmployees} icon={<Users size={18} />} tone="accent" delay={150} />
        <StatCard label={t('dashboard.presentToday')} value={stats.presentToday} icon={<CalendarCheck size={18} />} tone="success" delay={200} />
        <StatCard label={t('dashboard.absentToday')} value={stats.absentToday} icon={<CalendarX size={18} />} tone="danger" delay={250} />
        <StatCard label={t('dashboard.lateToday')} value={stats.lateToday} icon={<Clock size={18} />} tone="warning" delay={300} />
        <StatCard label={t('dashboard.onLeave')} value={stats.onLeaveToday} icon={<Plane size={18} />} delay={350} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('dashboard.headcountByDepartment')} />
          {departmentData.length === 0 ? (
            <EmptyState title={t('dashboard.noDataYet')} description={t('dashboard.noDataYetBody')} />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} margin={{ top: 8, right: 8, bottom: 8, left: -18 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--sf-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={48}
                    angle={-18}
                    textAnchor="end"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--sf-text-muted)' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    cursor={{ fill: 'color-mix(in srgb, var(--sf-primary) 8%, transparent)' }}
                    contentStyle={{
                      background: 'var(--sf-surface)',
                      border: '1px solid var(--sf-border)',
                      borderRadius: 10,
                      fontSize: 12,
                      color: 'var(--sf-text)',
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} fill="var(--sf-primary)" maxBarSize={54} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={t('dashboard.genderSplit')} />
          {genderData.length === 0 ? (
            <EmptyState title={t('dashboard.noDataYet')} />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="82%"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {genderData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(value) => (
                      <span style={{ color: 'var(--sf-text-muted)', fontSize: 12 }}>{value}</span>
                    )}
                  />
                  <ChartTooltip
                    contentStyle={{
                      background: 'var(--sf-surface)',
                      border: '1px solid var(--sf-border)',
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title={t('dashboard.employeeOfTheMonth')} />
          {eom ? (
            <div className="flex items-center gap-4">
              <EmployeeAvatar
                employee={{
                  id: eom.employee_id,
                  full_name_en: eom.full_name_en ?? null,
                  full_name_ar: eom.full_name_ar ?? null,
                  photo_url: eom.photo_url ?? null,
                  frame_id: eom.frame_id ?? null,
                }}
                size="lg"
                context={{ isEmployeeOfMonth: true }}
              />
              <div className="min-w-0">
                <EmployeeName
                  employee={{
                    full_name_en: eom.full_name_en ?? null,
                    full_name_ar: eom.full_name_ar ?? null,
                    name_color: eom.name_color ?? null,
                  }}
                  context={{ isEmployeeOfMonth: true }}
                  subtitle={localized(eom.department_name_en, eom.department_name_ar)}
                />
                <p className="mt-2 text-2xl font-extrabold text-content">
                  {formatPercent(eom.final_score, language)}
                </p>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={<Trophy size={22} />}
              title={t('ranking.noRanking')}
              description={t('ranking.noRankingBody')}
            />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t('dashboard.departmentPerformance')} />
          <div className="space-y-3">
            <MetricRow
              label={t('dashboard.averageAttendance')}
              value={formatPercent(stats.averageAttendance, language)}
              percent={stats.averageAttendance}
              icon={<CalendarCheck size={15} />}
            />
            <MetricRow
              label={t('dashboard.averageEvaluation')}
              value={formatPercent(stats.averageEvaluation, language)}
              percent={stats.averageEvaluation}
              color="var(--sf-success)"
              icon={<ClipboardCheck size={15} />}
            />
          </div>
        </Card>
      </div>
    </>
  );
}

function MetricRow({
  label,
  value,
  percent,
  color,
  icon,
}: {
  label: string;
  value: string;
  percent: number;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium text-content-muted">
          {icon}
          {label}
        </span>
        <span className="text-sm font-bold text-content">{value}</span>
      </div>
      <ProgressBar value={percent} color={color} />
    </div>
  );
}
