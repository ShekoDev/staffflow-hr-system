import { supabase, createProvisioningClient, describeError } from '@/lib/supabase';
import type { AppUser, Employee, Role, SessionProfile } from '@/types/models';

export interface SignInInput {
  email: string;
  password: string;
  rememberMe: boolean;
}

const REMEMBER_KEY = 'staffflow.remember';

export function getRememberedEmail(): string {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) ?? '';
  } catch {
    return '';
  }
}

function rememberEmail(email: string, remember: boolean): void {
  try {
    if (remember) window.localStorage.setItem(REMEMBER_KEY, email);
    else window.localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

export async function signIn({ email, password, rememberMe }: SignInInput): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(describeError(error));
  rememberEmail(email.trim(), rememberMe);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function requestPasswordReset(email: string): Promise<void> {
  const redirectTo = `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) throw new Error(describeError(error));
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(describeError(error));
  await supabase.from('users').update({ must_change_password: false }).eq('id', (await supabase.auth.getUser()).data.user?.id ?? '');
}

/**
 * Loads the signed-in user's profile: their `users` row, their linked
 * employee record, and the effective permission set computed in the
 * database (role grants merged with per-user overrides).
 */
export async function loadSessionProfile(userId: string): Promise<SessionProfile | null> {
  const [{ data: userRow, error: userError }, { data: permissionRows }] = await Promise.all([
    supabase
      .from('users')
      .select('*, role:roles(*)')
      .eq('id', userId)
      .maybeSingle(),
    supabase.rpc('my_permissions'),
  ]);

  if (userError || !userRow) return null;

  const user = userRow as AppUser & { role: Role | null };

  const { data: employeeRow } = await supabase
    .from('employees')
    .select('*, department:departments(id,name_en,name_ar), manager:employees!employees_manager_id_fkey(id,full_name_en,full_name_ar)')
    .eq('user_id', userId)
    .maybeSingle();

  const permissions = new Set<string>(
    ((permissionRows ?? []) as { key: string }[]).map((row) => row.key),
  );

  return {
    user,
    employee: (employeeRow as Employee | null) ?? null,
    roleKey: user.role?.key ?? 'employee',
    permissions,
  };
}

export async function touchLastLogin(userId: string): Promise<void> {
  await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', userId);
}

export interface ProvisionAccountInput {
  email: string;
  password: string;
  username?: string;
  roleKey?: string;
}

/**
 * Creates a login account for a new employee without disturbing the
 * administrator's own session (a throw-away client is used, and it never
 * persists its session).
 *
 * The database deliberately ignores any role sent at sign-up and creates
 * every account inactive, so the second step below — activating the
 * account and assigning its role — runs as the administrator and is what
 * the users.manage permission actually gates.
 */
export async function provisionAccount({
  email,
  password,
  username,
  roleKey = 'employee',
}: ProvisionAccountInput): Promise<string> {
  const client = createProvisioningClient();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { username: username ?? email.split('@')[0] } },
  });
  if (error) throw new Error(describeError(error));
  const newId = data.user?.id;
  if (!newId) throw new Error('Account creation did not return a user id.');
  await client.auth.signOut();

  const { data: role } = await supabase.from('roles').select('id').eq('key', roleKey).maybeSingle();
  const { error: activateError } = await supabase
    .from('users')
    .update({ is_active: true, role_id: (role as { id: string } | null)?.id ?? null })
    .eq('id', newId);
  if (activateError) throw new Error(describeError(activateError));

  return newId;
}
