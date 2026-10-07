import { supabase, describeError } from '@/lib/supabase';
import type { AppUser, Permission, Role, UserPermission } from '@/types/models';
import { logAudit } from './audit.service';

export async function fetchUsers(): Promise<AppUser[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*, role:roles(*)')
    .order('created_at', { ascending: false });
  if (error) throw new Error(describeError(error));
  return (data ?? []) as unknown as AppUser[];
}

export async function fetchRoles(): Promise<Role[]> {
  const { data, error } = await supabase.from('roles').select('*').order('rank');
  if (error) throw new Error(describeError(error));
  return (data ?? []) as Role[];
}

export async function fetchPermissions(): Promise<Permission[]> {
  const { data, error } = await supabase.from('permissions').select('*').order('module').order('key');
  if (error) throw new Error(describeError(error));
  return (data ?? []) as Permission[];
}

export async function fetchRolePermissions(): Promise<{ role_id: string; permission_id: string }[]> {
  const { data, error } = await supabase.from('role_permissions').select('role_id, permission_id');
  if (error) throw new Error(describeError(error));
  return data ?? [];
}

export async function fetchUserPermissions(userId: string): Promise<UserPermission[]> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', userId);
  if (error) throw new Error(describeError(error));
  return (data ?? []) as UserPermission[];
}

export async function setRolePermission(
  roleId: string,
  permissionId: string,
  enabled: boolean,
): Promise<void> {
  if (enabled) {
    const { error } = await supabase
      .from('role_permissions')
      .upsert({ role_id: roleId, permission_id: permissionId }, { onConflict: 'role_id,permission_id' });
    if (error) throw new Error(describeError(error));
  } else {
    const { error } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', roleId)
      .eq('permission_id', permissionId);
    if (error) throw new Error(describeError(error));
  }
  await logAudit('permission_change', 'role_permissions', roleId, null, {
    permission_id: permissionId,
    enabled,
  });
}

/**
 * Per-user override.
 *   'inherit' -> remove the row and fall back to the role
 *   'allow'   -> explicit grant
 *   'deny'    -> explicit deny, which beats the role grant
 */
export async function setUserPermission(
  userId: string,
  permissionId: string,
  mode: 'inherit' | 'allow' | 'deny',
): Promise<void> {
  if (mode === 'inherit') {
    const { error } = await supabase
      .from('user_permissions')
      .delete()
      .eq('user_id', userId)
      .eq('permission_id', permissionId);
    if (error) throw new Error(describeError(error));
  } else {
    const { error } = await supabase.from('user_permissions').upsert(
      { user_id: userId, permission_id: permissionId, granted: mode === 'allow' },
      { onConflict: 'user_id,permission_id' },
    );
    if (error) throw new Error(describeError(error));
  }
  await logAudit('permission_change', 'user_permissions', userId, null, {
    permission_id: permissionId,
    mode,
  });
}

export async function updateUserRole(userId: string, roleId: string): Promise<void> {
  const { error } = await supabase.from('users').update({ role_id: roleId }).eq('id', userId);
  if (error) throw new Error(describeError(error));
  await logAudit('role_change', 'users', userId, null, { role_id: roleId });
}

export async function setUserActive(userId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('users').update({ is_active: isActive }).eq('id', userId);
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'users', userId, null, { is_active: isActive });
}

export async function updateOwnPreferences(
  userId: string,
  prefs: Partial<Pick<AppUser, 'preferred_language' | 'preferred_theme' | 'color_mode'>>,
): Promise<void> {
  const { error } = await supabase.from('users').update(prefs).eq('id', userId);
  if (error) throw new Error(describeError(error));
}
