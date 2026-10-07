import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trophy } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import { PERMISSIONS } from '@/lib/permissions';
import { fetchMonthlyRanking, recomputeRanking } from '@/services/dashboard.service';
import { PageHeader } from '@/components/common/PageHeader';
import { PermissionGate } from '@/components/common/PermissionGate';
import { EmployeeAvatar, EmployeeIdentity } from '@/components/common/EmployeeIdentity';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/ui/Progress';
import { formatPercent, monthName } from '@/lib/format';
import type { MonthlyRanking } from '@/types/models';

const MEDALS = ['🥇', '🥈', '🥉'];

export function RankingPage({ employeeOfMonthOnly = false }: { employeeOfMonthOnly?: boolean }) {
  const { t, localized, language } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['ranking', year, month],
    queryFn: () => fetchMonthlyRanking(year, month),
  });

  const recompute = useMutation({
    mutationFn: () => recomputeRanking(year, month),
    onSuccess: () => {
      toast.success(t('ranking.recompute'));
      void queryClient.invalidateQueries({ queryKey: ['ranking'] });
      void queryClient.invalidateQueries({ queryKey: ['employee-of-month'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const winner = rows.find((row) => row.is_employee_of_month) ?? rows[0];
  const list = employeeOfMonthOnly ? rows.slice(0, 3) : rows;

  return (
    <>
      <PageHeader
        title={employeeOfMonthOnly ? t('nav.employeeOfTheMonth') : t('ranking.title')}
        subtitle={t('ranking.subtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
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
            <PermissionGate permission={PERMISSIONS.ranking.manage}>
              <Button
                variant="secondary"
                leftIcon={<RefreshCw size={15} />}
                loading={recompute.isPending}
                onClick={() => recompute.mutate()}
              >
                {t('ranking.recompute')}
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {isLoading ? (
        <Card>
          <SkeletonTable rows={5} cols={4} />
        </Card>
      ) : rows.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<Trophy size={24} />}
            title={t('ranking.noRanking')}
            description={t('ranking.noRankingBody')}
          />
        </Card>
      ) : (
        <>
          {winner && (
            <Card className="mb-4 overflow-hidden">
              <div
                className="-m-4 mb-4 p-5 sm:-m-5 sm:mb-5"
                style={{
                  background:
                    'linear-gradient(120deg, color-mix(in srgb, var(--sf-warning) 18%, transparent), transparent)',
                }}
              >
                <div className="flex flex-wrap items-center gap-5">
                  <EmployeeAvatar
                    employee={{
                      id: winner.employee_id,
                      full_name_en: winner.full_name_en ?? null,
                      full_name_ar: winner.full_name_ar ?? null,
                      photo_url: winner.photo_url ?? null,
                      frame_id: winner.frame_id ?? null,
                    }}
                    size="xl"
                    context={{ isEmployeeOfMonth: true }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-content-muted">
                      🏆 {t('dashboard.employeeOfTheMonth')} · {monthName(month, language)} {year}
                    </p>
                    <h2 className="mt-1 text-2xl font-extrabold text-content">
                      {localized(winner.full_name_en, winner.full_name_ar)}
                    </h2>
                    <p className="mt-0.5 text-sm text-content-muted">
                      {localized(winner.department_name_en, winner.department_name_ar)}
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-warning">
                      {formatPercent(winner.final_score, language)}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card padded={false}>
            <ul className="divide-y divide-line">
              {list.map((row, index) => (
                <RankingRow key={row.id} row={row} index={index} />
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}

function RankingRow({ row, index }: { row: MonthlyRanking; index: number }) {
  const { t, localized, language } = useI18n();

  return (
    <li
      className="flex flex-wrap items-center gap-3 px-4 py-3.5 animate-fade-in sm:px-5"
      style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
    >
      <span className="w-9 shrink-0 text-center text-lg font-extrabold text-content-muted">
        {row.rank && row.rank <= 3 ? MEDALS[row.rank - 1] : row.rank}
      </span>

      <div className="min-w-[10rem] flex-1">
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
          subtitle={localized(row.department_name_en, row.department_name_ar)}
        />
      </div>

      <div className="hidden min-w-[14rem] flex-1 gap-4 md:flex">
        <MiniMetric label={t('ranking.attendance')} value={row.attendance_score} language={language} />
        <MiniMetric label={t('ranking.punctuality')} value={row.punctuality_score} language={language} />
        <MiniMetric label={t('ranking.evaluation')} value={row.evaluation_score} language={language} />
      </div>

      <div className="w-28 shrink-0 text-end">
        <p className="text-lg font-extrabold text-content">{formatPercent(row.final_score, language)}</p>
        <ProgressBar value={row.final_score} className="mt-1" />
      </div>
    </li>
  );
}

function MiniMetric({
  label,
  value,
  language,
}: {
  label: string;
  value: number;
  language: 'en' | 'ar';
}) {
  return (
    <div className="min-w-0 flex-1">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-content-muted">
        {label}
      </p>
      <p className="text-sm font-bold text-content">{formatPercent(value, language)}</p>
    </div>
  );
}
