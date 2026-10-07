import { Filter, X } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useDepartments, useEmployeeOptions, useTeams } from '@/hooks/useOrganization';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, Input } from '@/components/ui/Field';
import { ATTENDANCE_STATUSES, type AttendanceQuery } from '@/services/attendance.service';
import type { AttendanceStatus, Gender } from '@/types/models';

export type FilterField =
  | 'employee'
  | 'department'
  | 'team'
  | 'manager'
  | 'gender'
  | 'status'
  | 'dates';

const ALL_FIELDS: FilterField[] = [
  'employee',
  'department',
  'team',
  'manager',
  'gender',
  'status',
  'dates',
];

/**
 * The advanced filter bar from the specification — employee, department,
 * team, manager, gender, date range and attendance status, all combinable.
 * Attendance, absence and every report screen share this one component so
 * the filters behave identically everywhere.
 */
export function FilterBar({
  value,
  onChange,
  fields = ALL_FIELDS,
  extra,
}: {
  value: AttendanceQuery;
  onChange: (next: AttendanceQuery) => void;
  fields?: FilterField[];
  extra?: React.ReactNode;
}) {
  const { t, localized } = useI18n();
  const { data: departments = [] } = useDepartments();
  const { data: teams = [] } = useTeams();
  const { data: employees = [] } = useEmployeeOptions();

  const show = (field: FilterField) => fields.includes(field);
  const set = (patch: Partial<AttendanceQuery>) => onChange({ ...value, ...patch });

  const activeCount = [
    value.employeeId,
    value.departmentId,
    value.teamId,
    value.managerId,
    value.gender,
    value.status,
  ].filter((v) => v && v !== 'all').length;

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
    <Card className="mb-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-bold text-content">
          <Filter size={15} />
          {t('common.filter')}
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
              {activeCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {extra}
          {activeCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              leftIcon={<X size={14} />}
              onClick={() =>
                onChange({
                  from: value.from,
                  to: value.to,
                  employeeId: 'all',
                  departmentId: 'all',
                  teamId: 'all',
                  managerId: 'all',
                  gender: 'all',
                  status: 'all',
                })
              }
            >
              {t('common.clear')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {show('employee') && (
          <Select
            label={t('employees.title')}
            value={value.employeeId ?? 'all'}
            onChange={(e) => set({ employeeId: e.target.value })}
          >
            <option value="all">{t('common.all')}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {localized(employee.full_name_en, employee.full_name_ar)}
              </option>
            ))}
          </Select>
        )}

        {show('department') && (
          <Select
            label={t('employees.department')}
            value={value.departmentId ?? 'all'}
            onChange={(e) => set({ departmentId: e.target.value })}
          >
            <option value="all">{t('common.all')}</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {localized(department.name_en, department.name_ar)}
              </option>
            ))}
          </Select>
        )}

        {show('team') && (
          <Select
            label={t('teams.title')}
            value={value.teamId ?? 'all'}
            onChange={(e) => set({ teamId: e.target.value })}
          >
            <option value="all">{t('common.all')}</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {localized(team.name_en, team.name_ar)}
              </option>
            ))}
          </Select>
        )}

        {show('manager') && (
          <Select
            label={t('employees.manager')}
            value={value.managerId ?? 'all'}
            onChange={(e) => set({ managerId: e.target.value })}
          >
            <option value="all">{t('common.all')}</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {localized(employee.full_name_en, employee.full_name_ar)}
              </option>
            ))}
          </Select>
        )}

        {show('gender') && (
          <Select
            label={t('common.gender')}
            value={value.gender ?? 'all'}
            onChange={(e) => set({ gender: e.target.value as Gender | 'all' })}
          >
            <option value="all">{t('common.all')}</option>
            <option value="male">{t('common.male')}</option>
            <option value="female">{t('common.female')}</option>
          </Select>
        )}

        {show('status') && (
          <Select
            label={t('common.status')}
            value={value.status ?? 'all'}
            onChange={(e) => set({ status: e.target.value as AttendanceStatus | 'all' })}
          >
            <option value="all">{t('common.all')}</option>
            {ATTENDANCE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </Select>
        )}

        {show('dates') && (
          <>
            <Input
              type="date"
              label={t('common.from')}
              value={value.from ?? ''}
              onChange={(e) => set({ from: e.target.value })}
            />
            <Input
              type="date"
              label={t('common.to')}
              value={value.to ?? ''}
              onChange={(e) => set({ to: e.target.value })}
            />
          </>
        )}
      </div>
    </Card>
  );
}

/** Convenience: first and last day of the current month as ISO dates. */
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (date: Date) => date.toLocaleDateString('en-CA');
  return { from: iso(first), to: iso(last) };
}

export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA');
}
