import { supabase, describeError } from '@/lib/supabase';
import { logAudit } from './audit.service';
import type { Badge, EmployeeBadge, NameColorRule, ProfileFrame, Theme } from '@/types/models';

export async function fetchFrames(): Promise<ProfileFrame[]> {
  const { data } = await supabase
    .from('profile_frames')
    .select('*')
    .eq('is_active', true)
    .order('priority');
  return (data ?? []) as ProfileFrame[];
}

export async function fetchBadges(): Promise<Badge[]> {
  const { data } = await supabase.from('badges').select('*').eq('is_active', true).order('priority');
  return (data ?? []) as Badge[];
}

export async function fetchNameColorRules(): Promise<NameColorRule[]> {
  const { data } = await supabase
    .from('name_color_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority');
  return (data ?? []) as NameColorRule[];
}

export async function fetchEmployeeBadges(employeeId: string): Promise<EmployeeBadge[]> {
  const { data } = await supabase
    .from('employee_badges')
    .select('*, badge:badges(*)')
    .eq('employee_id', employeeId);
  return (data ?? []) as unknown as EmployeeBadge[];
}

/* ------------------------------------------------------------------ */
/* Admin writes                                                        */
/*                                                                     */
/* Frames, badges, colour rules and themes are ordinary rows, so the   */
/* admin screens are plain CRUD. Nothing about the visual identity is  */
/* compiled into the app.                                              */
/* ------------------------------------------------------------------ */

type CustomizationTable = 'profile_frames' | 'badges' | 'name_color_rules' | 'themes';

export async function saveCustomizationRow(
  table: CustomizationTable,
  values: Record<string, unknown>,
  id?: string,
): Promise<void> {
  const payload = values as never;
  const query = id
    ? supabase.from(table).update(payload).eq('id', id)
    : supabase.from(table).insert(payload);
  const { error } = await query;
  if (error) throw new Error(describeError(error));
  await logAudit(id ? 'update' : 'create', table, id ?? null, String(values.key ?? ''));
}

export async function deleteCustomizationRow(
  table: CustomizationTable,
  id: string,
  label?: string,
): Promise<void> {
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('delete', table, id, label ?? null);
}

/** Every theme, including deactivated ones — the admin list needs them all. */
export async function fetchAllThemes(): Promise<Theme[]> {
  const { data, error } = await supabase.from('themes').select('*').order('sort_order');
  if (error) throw new Error(describeError(error));
  return (data ?? []) as Theme[];
}

export async function fetchAllFrames(): Promise<ProfileFrame[]> {
  const { data } = await supabase.from('profile_frames').select('*').order('priority');
  return (data ?? []) as ProfileFrame[];
}

export async function fetchAllBadges(): Promise<Badge[]> {
  const { data } = await supabase.from('badges').select('*').order('priority');
  return (data ?? []) as Badge[];
}

export async function fetchAllNameColorRules(): Promise<NameColorRule[]> {
  const { data } = await supabase.from('name_color_rules').select('*').order('priority');
  return (data ?? []) as NameColorRule[];
}
