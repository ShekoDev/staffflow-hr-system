import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * The single Supabase client used by the whole app.
 *
 * Everything goes through PostgREST with the signed-in user's JWT, so
 * Row Level Security — not the UI — is what actually protects the data.
 */
export const supabase: SupabaseClient = createClient(
  env.supabaseUrl || 'http://localhost:54321',
  env.supabaseAnonKey || 'public-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'staffflow.auth',
    },
    global: {
      headers: { 'x-application-name': 'staffflow' },
    },
  },
);

/**
 * A throw-away client used only when an administrator provisions a new
 * account. It never persists a session, so creating a user does not sign
 * the administrator out of their own session.
 */
export function createProvisioningClient(): SupabaseClient {
  return createClient(
    env.supabaseUrl || 'http://localhost:54321',
    env.supabaseAnonKey || 'public-anon-key',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'staffflow.provisioning',
      },
    },
  );
}

/** Normalises a PostgREST error into something safe to show a user. */
export function describeError(error: unknown): string {
  if (!error) return 'Unknown error';
  if (typeof error === 'string') return error;
  const e = error as { message?: string; details?: string; hint?: string; code?: string };
  if (e.code === '42501' || e.message?.includes('row-level security')) {
    return 'You do not have permission to perform this action.';
  }
  if (e.code === '23505') return 'A record with these details already exists.';
  return e.message || e.details || e.hint || 'Unexpected error';
}
