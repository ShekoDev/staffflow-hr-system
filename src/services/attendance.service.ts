import { supabase, describeError } from '@/lib/supabase';
import type {
  AttendanceRecord,
  AttendanceStatus,
  Employee,
  EmploymentStatus,
  Gender,
} from '@/types/models';
import { logAudit } from './audit.service';

const ATTENDANCE_SELECT = `
  *,
  employee:employees!inner(
    id, employee_code, full_name_en, full_name_ar, photo_url, job_title,
    gender, department_id, manager_id, employment_status, frame_id, name_color,
    department:departments(id,name_en,name_ar)
  )
`;

/** The filter set shared by the attendance screens and every report. */
export interface AttendanceQuery {
  employeeId?: string | 'all';
  departmentId?: string | 'all';
  teamId?: string | 'all';
  managerId?: string | 'all';
  gender?: Gender | 'all';
  status?: AttendanceStatus | 'all';
  employmentStatus?: EmploymentStatus | 'all';
  from?: string;
  to?: string;
}

/** Resolves a team filter into the employee ids that belong to it. */
async function teamMemberIds(teamId: string): Promise<string[]> {
  const { data } = await supabase.from('team_members').select('employee_id').eq('team_id', teamId);
  return ((data ?? []) as { employee_id: string }[]).map((row) => row.employee_id);
}

export async function fetchAttendance(query: AttendanceQuery = {}): Promise<AttendanceRecord[]> {
  let request = supabase
    .from('attendance')
    .select(ATTENDANCE_SELECT)
    .order('work_date', { ascending: false })
    .limit(2000);

  if (query.from) request = request.gte('work_date', query.from);
  if (query.to) request = request.lte('work_date', query.to);
  if (query.status && query.status !== 'all') request = request.eq('status', query.status);
  if (query.employeeId && query.employeeId !== 'all') {
    request = request.eq('employee_id', query.employeeId);
  }
  if (query.departmentId && query.departmentId !== 'all') {
    request = request.eq('employee.department_id', query.departmentId);
  }
  if (query.managerId && query.managerId !== 'all') {
    request = request.eq('employee.manager_id', query.managerId);
  }
  if (query.gender && query.gender !== 'all') {
    request = request.eq('employee.gender', query.gender);
  }
  if (query.teamId && query.teamId !== 'all') {
    const ids = await teamMemberIds(query.teamId);
    if (ids.length === 0) return [];
    request = request.in('employee_id', ids);
  }

  const { data, error } = await request;
  if (error) throw new Error(describeError(error));
  return (data ?? []) as unknown as AttendanceRecord[];
}

/**
 * The daily register: every employee the user may see, each paired with
 * their record for that date (or nothing, if it has not been taken yet).
 */
export interface RosterRow {
  employee: Employee;
  record: AttendanceRecord | null;
}

export async function fetchDailyRoster(
  workDate: string,
  query: AttendanceQuery = {},
): Promise<RosterRow[]> {
  let employeeRequest = supabase
    .from('employees')
    .select('*, department:departments(id,name_en,name_ar)')
    .order('full_name_en');

  if (query.employmentStatus !== 'all') {
    employeeRequest = employeeRequest.eq('employment_status', query.employmentStatus ?? 'active');
  }
  if (query.employeeId && query.employeeId !== 'all') {
    employeeRequest = employeeRequest.eq('id', query.employeeId);
  }
  if (query.departmentId && query.departmentId !== 'all') {
    employeeRequest = employeeRequest.eq('department_id', query.departmentId);
  }
  if (query.managerId && query.managerId !== 'all') {
    employeeRequest = employeeRequest.eq('manager_id', query.managerId);
  }
  if (query.gender && query.gender !== 'all') {
    employeeRequest = employeeRequest.eq('gender', query.gender);
  }
  if (query.teamId && query.teamId !== 'all') {
    const ids = await teamMemberIds(query.teamId);
    if (ids.length === 0) return [];
    employeeRequest = employeeRequest.in('id', ids);
  }

  const [{ data: employees, error }, { data: records }] = await Promise.all([
    employeeRequest,
    supabase.from('attendance').select('*').eq('work_date', workDate),
  ]);

  if (error) throw new Error(describeError(error));

  const byEmployee = new Map(
    ((records ?? []) as AttendanceRecord[]).map((row) => [row.employee_id, row]),
  );

  const rows = ((employees ?? []) as unknown as Employee[]).map((employee) => ({
    employee,
    record: byEmployee.get(employee.id) ?? null,
  }));

  if (query.status && query.status !== 'all') {
    return rows.filter((row) => row.record?.status === query.status);
  }
  return rows;
}

export interface AttendanceUpsert {
  employee_id: string;
  work_date: string;
  status: AttendanceStatus;
  check_in?: string | null;
  check_out?: string | null;
  late_minutes?: number;
  early_leave_minutes?: number;
  is_excused?: boolean;
  notes?: string | null;
}

/** Insert-or-update one day for one employee. */
export async function saveAttendance(record: AttendanceUpsert): Promise<void> {
  const { error } = await supabase
    .from('attendance')
    .upsert(record, { onConflict: 'employee_id,work_date' });
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'attendance', null, record.work_date, { ...record });
}

/** Save the whole register in one round-trip. */
export async function saveAttendanceBatch(records: AttendanceUpsert[]): Promise<void> {
  if (records.length === 0) return;
  const { error } = await supabase
    .from('attendance')
    .upsert(records, { onConflict: 'employee_id,work_date' });
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'attendance', null, `${records.length} records`, {
    work_date: records[0]?.work_date,
    count: records.length,
  });
}

export async function deleteAttendance(id: string): Promise<void> {
  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('delete', 'attendance', id);
}

/** One employee's month, used by the calendar view. */
export async function fetchEmployeeMonth(
  employeeId: string,
  year: number,
  month: number,
): Promise<AttendanceRecord[]> {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', employeeId)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date');
  if (error) throw new Error(describeError(error));
  return (data ?? []) as AttendanceRecord[];
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  leave: number;
  holiday: number;
  excused: number;
  earlyLeave: number;
  lateMinutes: number;
  attendanceRate: number;
  punctualityRate: number;
}

/** Pure function — the same maths is used on screen and inside exports. */
export function summarise(records: AttendanceRecord[]): AttendanceSummary {
  const count = (status: AttendanceStatus) => records.filter((r) => r.status === status).length;

  const present = count('present') + count('late') + count('early_leave');
  const absent = count('absent');
  const late = count('late');
  const workingDays = records.filter((r) => r.status !== 'holiday').length;

  return {
    total: records.length,
    present,
    absent,
    late,
    leave: count('leave'),
    holiday: count('holiday'),
    excused: count('excused'),
    earlyLeave: count('early_leave'),
    lateMinutes: records.reduce((sum, r) => sum + (r.late_minutes ?? 0), 0),
    attendanceRate: workingDays ? Math.round((present / workingDays) * 1000) / 10 : 0,
    punctualityRate: present ? Math.round(((present - late) / present) * 1000) / 10 : 100,
  };
}

export const ATTENDANCE_STATUSES: AttendanceStatus[] = [
  'present',
  'absent',
  'late',
  'leave',
  'holiday',
  'excused',
  'early_leave',
];

/** Tone used by pills, calendar cells and the PDF legend. */
export const STATUS_TONE: Record<AttendanceStatus, string> = {
  present: '#16a34a',
  absent: '#dc2626',
  late: '#d97706',
  leave: '#2563eb',
  holiday: '#6b7280',
  excused: '#0891b2',
  early_leave: '#9333ea',
};
