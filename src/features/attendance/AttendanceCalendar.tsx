import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useEmployeeOptions } from '@/hooks/useOrganization';
import { STATUS_TONE, fetchEmployeeMonth, summarise } from '@/services/attendance.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatPercent, monthName } from '@/lib/format';
import type { AttendanceStatus } from '@/types/models';

const WEEKDAY_KEYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEKDAY_AR = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

/**
 * Monthly calendar for one employee. Employees land here on their own
 * record; anyone with team or company visibility can pick a person.
 */
export function AttendanceCalendarPage({ selfOnly = false }: { selfOnly?: boolean }) {
  const { t, language, localized } = useI18n();
  const { profile } = useAuth();
  const { data: employees = [] } = useEmployeeOptions();

  const now = new Date();
  const [employeeId, setEmployeeId] = useState(profile?.employee?.id ?? '');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const activeEmployee = selfOnly ? (profile?.employee?.id ?? '') : employeeId;

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['employee-month', activeEmployee, year, month],
    queryFn: () => fetchEmployeeMonth(activeEmployee, year, month),
    enabled: Boolean(activeEmployee),
  });

  const byDay = useMemo(() => {
    const map = new Map<number, AttendanceStatus>();
    for (const record of records) {
      map.set(Number(record.work_date.slice(8, 10)), record.status);
    }
    return map;
  }, [records]);

  const summary = useMemo(() => summarise(records), [records]);

  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const weekdays = language === 'ar' ? WEEKDAY_AR : WEEKDAY_KEYS;

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

  return (
    <>
      <PageHeader
        title={selfOnly ? t('attendance.myAttendance') : t('attendance.calendar')}
        subtitle={t('attendance.calendarSubtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!selfOnly && (
              <Select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="h-10 w-52 py-0 text-sm"
              >
                <option value="">{t('common.select')}</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {localized(employee.full_name_en, employee.full_name_ar)}
                  </option>
                ))}
              </Select>
            )}
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

      {!activeEmployee ? (
        <Card padded={false}>
          <EmptyState icon={<CalendarDays size={24} />} title={t('attendance.selectEmployeeFirst')} />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
          <Card>
            {isLoading ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <>
                <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
                  {weekdays.map((day, index) => (
                    <div
                      key={`${day}-${index}`}
                      className="pb-1 text-center text-[11px] font-bold uppercase tracking-wide text-content-muted"
                    >
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {Array.from({ length: firstWeekday }).map((_, i) => (
                    <div key={`pad-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                    const status = byDay.get(day);
                    return (
                      <div
                        key={day}
                        title={status ? statusLabel(status) : t('attendance.notTaken')}
                        className="flex aspect-square flex-col items-center justify-center rounded-theme-sm border text-sm transition hover:scale-[1.04]"
                        style={{
                          borderColor: status ? STATUS_TONE[status] : 'var(--sf-border)',
                          background: status
                            ? `color-mix(in srgb, ${STATUS_TONE[status]} 13%, transparent)`
                            : 'transparent',
                          color: status ? STATUS_TONE[status] : 'var(--sf-text-muted)',
                        }}
                      >
                        <span className="font-bold">{day}</span>
                        {status && (
                          <span className="mt-0.5 hidden text-[9px] font-semibold sm:block">
                            {statusLabel(status).slice(0, 8)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap gap-3 border-t border-line pt-4">
                  {(Object.keys(STATUS_TONE) as AttendanceStatus[]).map((status) => (
                    <span key={status} className="flex items-center gap-1.5 text-xs text-content-muted">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: STATUS_TONE[status] }}
                      />
                      {statusLabel(status)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title={t('attendance.summary')} />
            <dl className="space-y-3">
              <Row label={t('attendance.present')} value={summary.present} />
              <Row label={t('attendance.absent')} value={summary.absent} />
              <Row label={t('attendance.late')} value={summary.late} />
              <Row label={t('attendance.leave')} value={summary.leave} />
              <Row label={t('attendance.excused')} value={summary.excused} />
              <Row label={t('attendance.totalLateMinutes')} value={summary.lateMinutes} />
              <div className="border-t border-line pt-3">
                <Row
                  label={t('attendance.attendanceRate')}
                  value={formatPercent(summary.attendanceRate, language)}
                  strong
                />
                <Row
                  label={t('attendance.punctualityRate')}
                  value={formatPercent(summary.punctualityRate, language)}
                  strong
                />
              </div>
            </dl>
          </Card>
        </div>
      )}
    </>
  );
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string | number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-sm text-content-muted">{label}</dt>
      <dd className={strong ? 'text-sm font-extrabold text-content' : 'text-sm font-semibold text-content'}>
        {value}
      </dd>
    </div>
  );
}
