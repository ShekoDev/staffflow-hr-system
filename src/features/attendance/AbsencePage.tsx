import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarX, Clock, Percent, TrendingUp } from 'lucide-react';
import { useI18n } from '@/i18n';
import {
  STATUS_TONE,
  fetchAttendance,
  summarise,
  type AttendanceQuery,
} from '@/services/attendance.service';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar, currentMonthRange } from '@/components/common/FilterBar';
import { EmployeeIdentity } from '@/components/common/EmployeeIdentity';
import { StatCard } from '@/components/common/StatCard';
import { Card } from '@/components/ui/Card';
import { DataTable, type Column } from '@/components/ui/Table';
import { Pill } from '@/components/ui/Badge';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate, formatPercent } from '@/lib/format';
import type { AttendanceRecord, AttendanceStatus } from '@/types/models';

/**
 * The absence view is the same dataset as the register, seen the other way
 * round: every recorded day, filtered, with the summary that reports use.
 */
export function AbsencePage() {
  const { t, localized, language } = useI18n();
  const [filters, setFilters] = useState<AttendanceQuery>(() => ({
    ...currentMonthRange(),
    status: 'absent',
  }));

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', filters],
    queryFn: () => fetchAttendance(filters),
  });

  const summary = useMemo(() => summarise(records), [records]);

  const statusLabel = (status: AttendanceStatus) =>
    ({
      present: t('attendance.present'),
      absent: t('attendance.absent'),
      late: t('attendance.late'),
      leave: t('attendance.leave'),
      holiday: t('attendance.holiday'),
      excused: t('attendance.excused'),
      early_leave: t('attendance.earlyLeave'),
    })[status];

  const columns: Column<AttendanceRecord>[] = [
    {
      key: 'employee',
      header: t('employees.title'),
      render: (row) => (
        <EmployeeIdentity
          employee={row.employee}
          subtitle={row.employee?.employee_code}
          size="xs"
        />
      ),
    },
    {
      key: 'department',
      header: t('employees.department'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-sm text-content-muted">
          {localized(row.employee?.department?.name_en, row.employee?.department?.name_ar) || '—'}
        </span>
      ),
    },
    {
      key: 'date',
      header: t('common.date'),
      render: (row) => (
        <span className="text-sm text-content">{formatDate(row.work_date, language)}</span>
      ),
    },
    {
      key: 'status',
      header: t('common.status'),
      render: (row) => (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{
            background: `color-mix(in srgb, ${STATUS_TONE[row.status]} 14%, transparent)`,
            color: STATUS_TONE[row.status],
          }}
        >
          {statusLabel(row.status)}
        </span>
      ),
    },
    {
      key: 'times',
      header: `${t('attendance.checkIn')} / ${t('attendance.checkOut')}`,
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-content-muted" dir="ltr">
          {(row.check_in?.slice(0, 5) ?? '—') + ' → ' + (row.check_out?.slice(0, 5) ?? '—')}
        </span>
      ),
    },
    {
      key: 'late',
      header: t('attendance.lateMinutes'),
      hideOnMobile: true,
      render: (row) =>
        row.late_minutes > 0 ? (
          <Pill tone="warning">{row.late_minutes}</Pill>
        ) : (
          <span className="text-xs text-content-muted">—</span>
        ),
    },
    {
      key: 'excused',
      header: t('attendance.excused'),
      hideOnMobile: true,
      render: (row) => (
        <Pill tone={row.is_excused ? 'success' : 'neutral'}>
          {row.is_excused ? t('common.yes') : t('attendance.unexcused')}
        </Pill>
      ),
    },
    {
      key: 'notes',
      header: t('common.notes'),
      hideOnMobile: true,
      render: (row) => (
        <span className="text-xs text-content-muted">{row.notes || '—'}</span>
      ),
    },
  ];

  return (
    <>
      <PageHeader title={t('attendance.absenceTitle')} subtitle={t('attendance.absenceSubtitle')} />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label={t('attendance.recordsFound')}
          value={summary.total}
          icon={<CalendarX size={18} />}
        />
        <StatCard
          label={t('attendance.late')}
          value={summary.late}
          icon={<Clock size={18} />}
          tone="warning"
          delay={60}
        />
        <StatCard
          label={t('attendance.attendanceRate')}
          value={formatPercent(summary.attendanceRate, language)}
          icon={<Percent size={18} />}
          tone="success"
          delay={120}
        />
        <StatCard
          label={t('attendance.punctualityRate')}
          value={formatPercent(summary.punctualityRate, language)}
          icon={<TrendingUp size={18} />}
          tone="accent"
          delay={180}
        />
      </div>

      <FilterBar value={filters} onChange={setFilters} />

      {isLoading ? (
        <Card>
          <SkeletonTable />
        </Card>
      ) : (
        <DataTable
          columns={columns}
          rows={records}
          rowKey={(row) => row.id}
          emptyState={
            <EmptyState
              icon={<CalendarX size={24} />}
              title={t('attendance.noRecords')}
              description={t('attendance.noRecordsBody')}
            />
          }
        />
      )}
    </>
  );
}
