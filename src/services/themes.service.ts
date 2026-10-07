import { supabase } from '@/lib/supabase';
import type { Theme } from '@/types/models';

/** Built-in fallback so the UI still renders if the table is unreachable. */
export const FALLBACK_THEME: Theme = {
  id: 'fallback',
  key: 'modern-blue',
  name_en: 'Modern Blue',
  name_ar: 'الأزرق العصري',
  sort_order: 0,
  is_active: true,
  tokens_light: {
    primary: '#2563eb',
    'primary-hover': '#1d4ed8',
    'primary-fg': '#ffffff',
    accent: '#38bdf8',
    bg: '#f4f7fb',
    surface: '#ffffff',
    'surface-2': '#f8fafc',
    border: '#e2e8f0',
    text: '#0f172a',
    'text-muted': '#64748b',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    radius: '14px',
    shadow: '0 1px 2px rgba(15,23,42,.06), 0 8px 24px -12px rgba(15,23,42,.18)',
    'surface-blur': 'none',
  },
  tokens_dark: {
    primary: '#3b82f6',
    'primary-hover': '#60a5fa',
    'primary-fg': '#04121f',
    accent: '#38bdf8',
    bg: '#0b1220',
    surface: '#111a2c',
    'surface-2': '#0f1728',
    border: '#1e293b',
    text: '#e2e8f0',
    'text-muted': '#94a3b8',
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    radius: '14px',
    shadow: '0 1px 2px rgba(0,0,0,.5), 0 8px 24px -12px rgba(0,0,0,.7)',
    'surface-blur': 'none',
  },
};

export async function fetchThemes(): Promise<Theme[]> {
  const { data, error } = await supabase
    .from('themes')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error || !data || data.length === 0) return [FALLBACK_THEME];
  return data as Theme[];
}
