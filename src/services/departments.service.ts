import { supabase, describeError } from '@/lib/supabase';
import type { Department } from '@/types/models';
import { logAudit } from './audit.service';

const DEPARTMENT_SELECT = `
  *,
  manager:employees!departments_manager_fk(id,full_name_en,full_name_ar,photo_url)
`;

export async function fetchDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select(DEPARTMENT_SELECT)
    .order('name_en');
  if (error) throw new Error(describeError(error));

  const departments = (data ?? []) as unknown as Department[];

  // Headcount per department, resolved in one extra round-trip.
  const { data: counts } = await supabase
    .from('employees')
    .select('department_id')
    .eq('employment_status', 'active');

  const tally = new Map<string, number>();
  for (const row of (counts ?? []) as { department_id: string | null }[]) {
    if (!row.department_id) continue;
    tally.set(row.department_id, (tally.get(row.department_id) ?? 0) + 1);
  }
  return departments.map((d) => ({ ...d, employee_count: tally.get(d.id) ?? 0 }));
}

export type DepartmentInput = {
  name_en: string;
  name_ar: string;
  code?: string | null;
  description?: string | null;
  manager_id?: string | null;
  is_active: boolean;
};

export async function createDepartment(input: DepartmentInput): Promise<Department> {
  const { data, error } = await supabase.from('departments').insert(input).select(DEPARTMENT_SELECT).single();
  if (error) throw new Error(describeError(error));
  const created = data as unknown as Department;
  await logAudit('create', 'departments', created.id, created.name_en);
  return created;
}

export async function updateDepartment(id: string, input: Partial<DepartmentInput>): Promise<Department> {
  const { data, error } = await supabase
    .from('departments')
    .update(input)
    .eq('id', id)
    .select(DEPARTMENT_SELECT)
    .single();
  if (error) throw new Error(describeError(error));
  const updated = data as unknown as Department;
  await logAudit('update', 'departments', id, updated.name_en, input as Record<string, unknown>);
  return updated;
}

export async function deleteDepartment(id: string, label?: string): Promise<void> {
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('delete', 'departments', id, label ?? null);
}
