import { supabase, describeError } from '@/lib/supabase';
import type { Employee, Team } from '@/types/models';
import { logAudit } from './audit.service';

const TEAM_SELECT = `
  *,
  department:departments(id,name_en,name_ar),
  manager:employees!teams_manager_id_fkey(id,full_name_en,full_name_ar,photo_url)
`;

export async function fetchTeams(): Promise<Team[]> {
  const { data, error } = await supabase.from('teams').select(TEAM_SELECT).order('name_en');
  if (error) throw new Error(describeError(error));
  const teams = (data ?? []) as unknown as Team[];

  const { data: members } = await supabase.from('team_members').select('team_id');
  const tally = new Map<string, number>();
  for (const row of (members ?? []) as { team_id: string }[]) {
    tally.set(row.team_id, (tally.get(row.team_id) ?? 0) + 1);
  }
  return teams.map((t) => ({ ...t, member_count: tally.get(t.id) ?? 0 }));
}

export async function fetchTeamMembers(teamId: string): Promise<Employee[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('employee:employees(id,full_name_en,full_name_ar,photo_url,job_title,employee_code,employment_status,frame_id,name_color)')
    .eq('team_id', teamId);
  if (error) throw new Error(describeError(error));
  return ((data ?? []) as unknown as { employee: Employee }[])
    .map((row) => row.employee)
    .filter(Boolean);
}

export type TeamInput = {
  name_en: string;
  name_ar?: string | null;
  department_id?: string | null;
  manager_id?: string | null;
  description?: string | null;
  is_active: boolean;
};

export async function createTeam(input: TeamInput): Promise<Team> {
  const { data, error } = await supabase.from('teams').insert(input).select(TEAM_SELECT).single();
  if (error) throw new Error(describeError(error));
  const created = data as unknown as Team;
  await logAudit('create', 'teams', created.id, created.name_en);
  return created;
}

export async function updateTeam(id: string, input: Partial<TeamInput>): Promise<Team> {
  const { data, error } = await supabase.from('teams').update(input).eq('id', id).select(TEAM_SELECT).single();
  if (error) throw new Error(describeError(error));
  const updated = data as unknown as Team;
  await logAudit('update', 'teams', id, updated.name_en, input as Record<string, unknown>);
  return updated;
}

export async function deleteTeam(id: string, label?: string): Promise<void> {
  const { error } = await supabase.from('teams').delete().eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('delete', 'teams', id, label ?? null);
}

export async function addTeamMember(teamId: string, employeeId: string): Promise<void> {
  const { error } = await supabase.from('team_members').insert({ team_id: teamId, employee_id: employeeId });
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'teams', teamId, null, { added_member: employeeId });
}

export async function removeTeamMember(teamId: string, employeeId: string): Promise<void> {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('employee_id', employeeId);
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'teams', teamId, null, { removed_member: employeeId });
}
