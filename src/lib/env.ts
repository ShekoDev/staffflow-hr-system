/**
 * Environment access is centralised so nothing else in the app reads
 * import.meta.env directly. Missing configuration fails loudly and early.
 */
export interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  isConfigured: boolean;
}

const url = import.meta.env.VITE_SUPABASE_URL ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export const env: AppEnv = {
  supabaseUrl: url,
  supabaseAnonKey: anonKey,
  isConfigured: Boolean(url && anonKey && !url.includes('YOUR-PROJECT-REF')),
};
