import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck, CalendarX, Clock, Plane, Save } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { PERMISSIONS } from '@/lib/permissions';
import {
  ATTENDANCE_STATUSES,
  STATUS_TONE,
  fetchDailyRoster,
  saveAttendanceBatch,
  type AttendanceQuery,
  type AttendanceUpsert,
  type RosterRow,
} from '@/services/attendance.service';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar, todayIso } from '@/components/common/FilterBar';
import { EmployeeIdentity } from '@/components/common/EmployeeIdentity';
import { StatCard } from '@/components/common/StatCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { SkeletonTable } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AttendanceStatus } from '@/types/models';

interface DraftRow {
  status: AttendanceStatus | 'none';
  check_in: string;
  check_out: string;
  late_minutes: number;
  notes: string;
}

const EMPTY_DRAFT: DraftRow = {
  status: 'none',
  check_in: '',
  check_out: '',
  late_minutes: 0,
  notes: '',
};

/** Minutes between two HH:MM strings, floored at zero. */
function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0;
  return Math.max(0, eh * 60 + em - (sh * 60 + sm));
}

export function DailyAttendancePage() {
  const { t } = useI18n();
  const { can } = useAuth();
  const toast = useToast();
  const { settings } = useSettings();
  const queryClient = useQueryClient();

  const [workDate, setWorkDate] = useState(todayIso);
  const [filters, setFilters] = useState<AttendanceQuery>({});
  const [draft, setDraft] = useState<Record<string, DraftRow>>({});

  const canEdit = can(PERMISSIONS.attendance.manage) || can(PERMISSIONS.attendance.manageTeam);

  const { data, isLoading } = useQuery({
    queryKey: ['roster', workDate, filters],
    queryFn: () => fetchDailyRoster(workDate, filters),
  });

  // Memoised rather than defaulted inline: `data ?? []` would hand the effect
  // below a new array on every render and spin it in a loop while loading.
  const roster = useMemo(() => data ?? [], [data]);

  // Reset the working copy whenever the day or the roster changes.
  useEffect(() => {
    const next: Record<string, DraftRow> = {};
    for (const row of roster) {
      next[row.employee.id] = row.record
        ? {
            status: row.record.status,
            check_in: row.record.check_in?.slice(0, 5) ?? '',
            check_out: row.record.check_out?.slice(0, 5) ?? '',
            late_minutes: row.record.late_minutes ?? 0,
            notes: row.record.notes ?? '',
          }
        : { ...EMPTY_DRAFT };
    }
    setDraft(next);
  }, [roster]);

  const patch = (employeeId: string, changes: Partial<DraftRow>) =>
    setDraft((current) => ({
      ...current,
      [employeeId]: { ...(current[employeeId] ?? EMPTY_DRAFT), ...changes },
    }));

  /** Applies the work-start rule: arriving after the grace period is "late". */
  const applyCheckIn = (employeeId: string, checkIn: string) => {
    const rules = settings.attendance_rules;
    const graceEnd = (() => {
      const [h, m] = rules.work_start.split(':').map(Number);
      const total = h * 60 + m + (rules.late_grace_minutes ?? 0);
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    })();

    const late = checkIn && checkIn > graceEnd ? minutesBetween(rules.work_start, checkIn) : 0;
    patch(employeeId, {
      check_in: checkIn,
      late_minutes: late,
      status: late > 0 ? 'late' : 'present',
    });
  };

  const setAll = (status: AttendanceStatus | 'none') => {
    setDraft((current) => {
      const next = { ...current };
      for (const row of roster) {
        next[row.employee.id] = { ...(next[row.employee.id] ?? EMPTY_DRAFT), status };
      }
      return next;
    });
  };

  const counts = useMemo(() => {
    const values = Object.values(draft);
    const by = (status: AttendanceStatus) => values.filter((d) => d.status === status).length;
    return {
      present: by('present') + by('late') + by('early_leave'),
      absent: by('absent'),
      late: by('late'),
      leave: by('leave'),
      pending: values.filter((d) => d.status === 'none').length,
    };
  }, [draft]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const records: AttendanceUpsert[] = [];
      for (const row of roster) {
        const entry = draft[row.employee.id];
        if (!entry || entry.status === 'none') continue;
        records.push({
          employee_id: row.employee.id,
          work_date: workDate,
          status: entry.status,
          check_in: entry.check_in || null,
          check_out: entry.check_out || null,
          late_minutes: entry.late_minutes || 0,
          early_leave_minutes: 0,
          is_excused: entry.status === 'excused',
          notes: entry.notes || null,
        });
      }
      return saveAttendanceBatch(records);
    },
    onSuccess: () => {
      toast.success(t('attendance.saved'));
      void queryClient.invalidateQueries({ queryKey: ['roster'] });
      void queryClient.invalidateQueries({ queryKey: ['attendance'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

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
        title={t('attendance.register')}
        subtitle={t('attendance.registerHint')}
        actions={
          canEdit && (
            <Button
              leftIcon={<Save size={16} />}
              loading={saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {t('attendance.saveRegister')}
            </Button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label={t('attendance.present')} value={counts.present} icon={<CalendarCheck size={18} />} tone="success" />
        <StatCard label={t('attendance.absent')} value={counts.absent} icon={<CalendarX size={18} />} tone="danger" delay={60} />
        <StatCard label={t('attendance.late')} value={counts.late} icon={<Clock size={18} />} tone="warning" delay={120} />
        <StatCard label={t('attendance.leave')} value={counts.leave} icon={<Plane size={18} />} delay={180} />
      </div>

      <FilterBar
        value={filters}
        onChange={setFilters}
        fields={['employee', 'department', 'team', 'manager', 'gender']}
        extra={
          <Input
            type="date"
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="h-9 py-0 text-sm"
            wrapperClassName="w-44"
          />
        }
      />

      {canEdit && roster.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAll('present')}>
            {t('attendance.markAllPresent')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setAll('absent')}>
            {t('attendance.markAllAbsent')}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAll('none')}>
            {t('attendance.clearAll')}
          </Button>
        </div>
      )}

      {isLoading ? (
        <Card>
          <SkeletonTable rows={8} cols={5} />
        </Card>
      ) : roster.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<CalendarCheck size={24} />}
            title={t('attendance.noRecords')}
            description={t('attendance.noRecordsBody')}
          />
        </Card>
      ) : (
        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[54rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-alt/70 text-[11px] uppercase tracking-wide text-content-muted">
                  <th className="px-4 py-3 text-start font-bold">{t('employees.title')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('common.status')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('attendance.checkIn')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('attendance.checkOut')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('attendance.lateMinutes')}</th>
                  <th className="px-4 py-3 text-start font-bold">{t('common.notes')}</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((row: RosterRow, index) => {
                  const entry = draft[row.employee.id] ?? EMPTY_DRAFT;
                  return (
                    <tr
                      key={row.employee.id}
                      className="border-b border-line/70 last:border-0 animate-fade-in"
                      style={{ animationDelay: `${Math.min(index, 15) * 18}ms` }}
                    >
                      <td className="px-4 py-2.5">
                        <EmployeeIdentity
                          employee={row.employee}
                          subtitle={row.employee.employee_code}
                          size="xs"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              background:
                                entry.status === 'none'
                                  ? 'var(--sf-border)'
                                  : STATUS_TONE[entry.status],
                            }}
                          />
                          <select
                            className="sf-input h-9 w-36 py-0 text-xs"
                            disabled={!canEdit}
                            value={entry.status}
                            onChange={(e) =>
                              patch(row.employee.id, {
                                status: e.target.value as AttendanceStatus | 'none',
                              })
                            }
                          >
                            <option value="none">{t('attendance.notTaken')}</option>
                            {ATTENDANCE_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {statusLabel(status)}
                              </option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="time"
                          className="sf-input h-9 w-28 py-0 text-xs"
                          disabled={!canEdit}
                          value={entry.check_in}
                          onChange={(e) => applyCheckIn(row.employee.id, e.target.value)}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="time"
                          className="sf-input h-9 w-28 py-0 text-xs"
                          disabled={!canEdit}
                          value={entry.check_out}
                          onChange={(e) => patch(row.employee.id, { check_out: e.target.value })}
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          className="sf-input h-9 w-20 py-0 text-xs"
                          disabled={!canEdit}
                          value={entry.late_minutes}
                          onChange={(e) =>
                            patch(row.employee.id, { late_minutes: Number(e.target.value) || 0 })
                          }
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          className="sf-input h-9 min-w-[10rem] py-0 text-xs"
                          disabled={!canEdit}
                          value={entry.notes}
                          onChange={(e) => patch(row.employee.id, { notes: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
