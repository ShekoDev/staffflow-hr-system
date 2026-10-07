import { supabase, describeError } from '@/lib/supabase';
import type { LeaveRequest, LeaveStatus, LeaveType } from '@/types/models';
import { logAudit } from './audit.service';

const LEAVE_SELECT = `
  *,
  employee:employees!inner(
    id, employee_code, full_name_en, full_name_ar, photo_url, job_title,
    gender, department_id, manager_id, frame_id, name_color,
    department:departments(id,name_en,name_ar)
  ),
  leave_type:leave_types(*)
`;

export interface LeaveQuery {
  employeeId?: string | 'all';
  departmentId?: string | 'all';
  status?: LeaveStatus | 'all';
  from?: string;
  to?: string;
}

export async function fetchLeaveTypes(): Promise<LeaveType[]> {
  const { data } = await supabase
    .from('leave_types')
    .select('*')
    .eq('is_active', true)
    .order('name_en');
  return (data ?? []) as LeaveType[];
}

export async function fetchLeaveRequests(query: LeaveQuery = {}): Promise<LeaveRequest[]> {
  let request = supabase
    .from('leave_requests')
    .select(LEAVE_SELECT)
    .order('created_at', { ascending: false })
    .limit(500);

  if (query.status && query.status !== 'all') request = request.eq('status', query.status);
  if (query.employeeId && query.employeeId !== 'all') {
    request = request.eq('employee_id', query.employeeId);
  }
  if (query.departmentId && query.departmentId !== 'all') {
    request = request.eq('employee.department_id', query.departmentId);
  }
  if (query.from) request = request.gte('end_date', query.from);
  if (query.to) request = request.lte('start_date', query.to);

  const { data, error } = await request;
  if (error) throw new Error(describeError(error));
  return (data ?? []) as unknown as LeaveRequest[];
}

export interface LeaveInput {
  employee_id: string;
  leave_type_id: string | null;
  start_date: string;
  end_date: string;
  reason: string | null;
}

export async function createLeaveRequest(input: LeaveInput): Promise<void> {
  const { error } = await supabase.from('leave_requests').insert(input);
  if (error) throw new Error(describeError(error));
  await logAudit('create', 'leave_requests', null, `${input.start_date} → ${input.end_date}`);
}

export async function reviewLeaveRequest(
  id: string,
  status: Extract<LeaveStatus, 'approved' | 'rejected'>,
  note: string | null,
): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('leave_requests')
    .update({
      status,
      review_note: note,
      reviewed_by: session.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'leave_requests', id, status);
}

export async function cancelLeaveRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from('leave_requests')
    .update({ status: 'cancelled' })
    .eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'leave_requests', id, 'cancelled');
}
