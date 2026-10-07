import { supabase, describeError } from '@/lib/supabase';
import type { Employee, EmploymentStatus, Gender, Paginated } from '@/types/models';
import { logAudit } from './audit.service';

const EMPLOYEE_SELECT = `
  *,
  department:departments(id,name_en,name_ar),
  manager:employees!employees_manager_id_fkey(id,full_name_en,full_name_ar),
  user:users(id,email,username,is_active,role_id)
`;

export interface EmployeeFilters {
  search?: string;
  departmentId?: string | 'all';
  managerId?: string | 'all';
  gender?: Gender | 'all';
  status?: EmploymentStatus | 'all';
  page?: number;
  pageSize?: number;
}

export async function fetchEmployees(filters: EmployeeFilters = {}): Promise<Paginated<Employee>> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('employees')
    .select(EMPLOYEE_SELECT, { count: 'exact' })
    .order('full_name_en');

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(
      `full_name_en.ilike.${term},full_name_ar.ilike.${term},employee_code.ilike.${term},job_title.ilike.${term},email.ilike.${term}`,
    );
  }
  if (filters.departmentId && filters.departmentId !== 'all') {
    query = query.eq('department_id', filters.departmentId);
  }
  if (filters.managerId && filters.managerId !== 'all') {
    query = query.eq('manager_id', filters.managerId);
  }
  if (filters.gender && filters.gender !== 'all') {
    query = query.eq('gender', filters.gender);
  }
  if (filters.status && filters.status !== 'all') {
    query = query.eq('employment_status', filters.status);
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(describeError(error));
  return { rows: (data ?? []) as unknown as Employee[], total: count ?? 0 };
}

/** Lightweight list used to populate manager / employee pickers. */
export async function fetchEmployeeOptions(): Promise<
  Pick<Employee, 'id' | 'full_name_en' | 'full_name_ar' | 'employee_code' | 'photo_url'>[]
> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name_en, full_name_ar, employee_code, photo_url')
    .eq('employment_status', 'active')
    .order('full_name_en');
  if (error) throw new Error(describeError(error));
  return data ?? [];
}

export async function fetchEmployee(id: string): Promise<Employee | null> {
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_SELECT)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(describeError(error));
  return (data as unknown as Employee) ?? null;
}

export async function fetchDirectReports(managerId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name_en, full_name_ar, photo_url, job_title, employee_code, employment_status, frame_id, name_color, department_id, user_id, email, phone, gender, joining_date, manager_id, notes, created_at, updated_at')
    .eq('manager_id', managerId)
    .order('full_name_en');
  if (error) throw new Error(describeError(error));
  return (data ?? []) as unknown as Employee[];
}

export type EmployeeInput = {
  employee_code: string;
  full_name_en: string;
  full_name_ar?: string | null;
  photo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  department_id?: string | null;
  manager_id?: string | null;
  gender?: Gender | null;
  joining_date?: string | null;
  employment_status: EmploymentStatus;
  frame_id?: string | null;
  name_color?: string | null;
  notes?: string | null;
  user_id?: string | null;
};

export async function createEmployee(input: EmployeeInput): Promise<Employee> {
  const { data, error } = await supabase.from('employees').insert(input).select(EMPLOYEE_SELECT).single();
  if (error) throw new Error(describeError(error));
  const created = data as unknown as Employee;
  await logAudit('create', 'employees', created.id, created.full_name_en);
  return created;
}

export async function updateEmployee(id: string, input: Partial<EmployeeInput>): Promise<Employee> {
  const { data, error } = await supabase
    .from('employees')
    .update(input)
    .eq('id', id)
    .select(EMPLOYEE_SELECT)
    .single();
  if (error) throw new Error(describeError(error));
  const updated = data as unknown as Employee;
  await logAudit('update', 'employees', id, updated.full_name_en, input as Record<string, unknown>);
  return updated;
}

export async function setEmploymentStatus(id: string, status: EmploymentStatus): Promise<void> {
  const { error } = await supabase.from('employees').update({ employment_status: status }).eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'employees', id, null, { employment_status: status });
}

export async function deleteEmployee(id: string, label?: string): Promise<void> {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('delete', 'employees', id, label ?? null);
}

/** Suggests the next sequential employee code, e.g. EMP-0042. */
export async function suggestEmployeeCode(): Promise<string> {
  const { data } = await supabase
    .from('employees')
    .select('employee_code')
    .order('created_at', { ascending: false })
    .limit(50);
  const numbers = (data ?? [])
    .map((row) => Number.parseInt(String(row.employee_code).replace(/\D/g, ''), 10))
    .filter((n) => Number.isFinite(n));
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return `EMP-${String(next).padStart(4, '0')}`;
}
