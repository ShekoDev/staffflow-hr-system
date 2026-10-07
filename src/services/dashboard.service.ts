import { supabase } from '@/lib/supabase';
import type { MonthlyRanking, Notification } from '@/types/models';

export interface AdminStats {
  totalEmployees: number;
  activeEmployees: number;
  maleEmployees: number;
  femaleEmployees: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeaveToday: number;
  averageAttendance: number;
  averageEvaluation: number;
  departments: { name_en: string; name_ar: string; headcount: number }[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const today = todayIso();

  const [employees, attendance, evaluations, departments] = await Promise.all([
    supabase.from('employees').select('id, gender, employment_status, department_id'),
    supabase.from('attendance').select('status').eq('work_date', today),
    supabase.from('evaluations').select('percentage').eq('status', 'approved'),
    supabase.from('departments').select('id, name_en, name_ar'),
  ]);

  const empRows = (employees.data ?? []) as {
    id: string;
    gender: string | null;
    employment_status: string;
    department_id: string | null;
  }[];
  const attRows = (attendance.data ?? []) as { status: string }[];
  const evalRows = (evaluations.data ?? []) as { percentage: number | null }[];
  const deptRows = (departments.data ?? []) as { id: string; name_en: string; name_ar: string }[];

  const activeEmployees = empRows.filter((e) => e.employment_status === 'active').length;
  const presentToday = attRows.filter((a) => ['present', 'late', 'early_leave'].includes(a.status)).length;
  const absentToday = attRows.filter((a) => a.status === 'absent').length;
  const lateToday = attRows.filter((a) => a.status === 'late').length;
  const onLeaveToday = attRows.filter((a) => a.status === 'leave').length;

  const scored = evalRows.map((e) => e.percentage ?? 0).filter((n) => n > 0);
  const averageEvaluation = scored.length
    ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10
    : 0;

  const counted = attRows.length;
  const averageAttendance = counted ? Math.round((presentToday / counted) * 1000) / 10 : 0;

  const headcount = new Map<string, number>();
  for (const e of empRows) {
    if (e.employment_status !== 'active' || !e.department_id) continue;
    headcount.set(e.department_id, (headcount.get(e.department_id) ?? 0) + 1);
  }

  return {
    totalEmployees: empRows.length,
    activeEmployees,
    maleEmployees: empRows.filter((e) => e.gender === 'male').length,
    femaleEmployees: empRows.filter((e) => e.gender === 'female').length,
    presentToday,
    absentToday,
    lateToday,
    onLeaveToday,
    averageAttendance,
    averageEvaluation,
    departments: deptRows.map((d) => ({
      name_en: d.name_en,
      name_ar: d.name_ar,
      headcount: headcount.get(d.id) ?? 0,
    })),
  };
}

export async function fetchEmployeeOfTheMonth(): Promise<MonthlyRanking | null> {
  const now = new Date();
  const { data } = await supabase
    .from('v_monthly_ranking')
    .select('*')
    .eq('period_year', now.getFullYear())
    .eq('period_month', now.getMonth() + 1)
    .eq('is_employee_of_month', true)
    .limit(1)
    .maybeSingle();
  return (data as MonthlyRanking) ?? null;
}

export async function fetchMonthlyRanking(year: number, month: number): Promise<MonthlyRanking[]> {
  const { data } = await supabase
    .from('v_monthly_ranking')
    .select('*')
    .eq('period_year', year)
    .eq('period_month', month)
    .order('rank');
  return (data ?? []) as MonthlyRanking[];
}

export async function recomputeRanking(year: number, month: number): Promise<void> {
  const { error } = await supabase.rpc('compute_monthly_ranking', {
    p_year: year,
    p_month: month,
  });
  if (error) throw error;
}

export async function fetchMyRanking(employeeId: string): Promise<MonthlyRanking | null> {
  const now = new Date();
  const { data } = await supabase
    .from('monthly_rankings')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('period_year', now.getFullYear())
    .eq('period_month', now.getMonth() + 1)
    .maybeSingle();
  return (data as MonthlyRanking) ?? null;
}

export async function fetchNotifications(limit = 10): Promise<Notification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as Notification[];
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from('notifications').update({ is_read: true }).eq('id', id);
}
