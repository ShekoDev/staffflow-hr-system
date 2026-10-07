import { supabase } from '@/lib/supabase';
import type { SystemSettingsMap } from '@/types/models';

export const DEFAULT_SETTINGS: SystemSettingsMap = {
  branding: {
    company_name_en: 'StaffFlow',
    company_name_ar: 'ستاف فلو',
    system_name_en: 'Employee Management & HR System',
    system_name_ar: 'نظام إدارة الموظفين والموارد البشرية',
    logo_url: null,
    favicon_url: null,
  },
  pdf_branding: {
    footer_text_ar: 'جميع حقوق الملكية محفوظة لمحمود شهاب',
    footer_text_en: 'All rights reserved to Mahmoud Shehab',
    show_logo: true,
    accent_color: '#2563eb',
  },
  appearance: {
    default_theme: 'modern-blue',
    default_color_mode: 'system',
    allow_user_theme: true,
    default_language: 'en',
    allow_user_language: true,
  },
  attendance_rules: {
    work_start: '09:00',
    work_end: '17:00',
    late_grace_minutes: 15,
    work_days: [0, 1, 2, 3, 4],
  },
  ranking_weights: { attendance: 25, punctuality: 15, evaluation: 60 },
  splash: { enabled: true, duration_ms: 2200, media_type: 'placeholder', media_url: null },
};

interface SettingRow {
  key: string;
  value: unknown;
}

/** Loads every readable setting and merges it over the built-in defaults. */
export async function fetchSettings(): Promise<SystemSettingsMap> {
  const { data, error } = await supabase.from('system_settings').select('key, value');
  if (error || !data) return DEFAULT_SETTINGS;

  const merged: SystemSettingsMap = structuredClone(DEFAULT_SETTINGS);
  for (const row of data as SettingRow[]) {
    const key = row.key as keyof SystemSettingsMap;
    if (key in merged && row.value && typeof row.value === 'object') {
      merged[key] = { ...merged[key], ...(row.value as object) } as never;
    }
  }
  return merged;
}

export async function updateSetting<K extends keyof SystemSettingsMap>(
  key: K,
  value: SystemSettingsMap[K],
): Promise<void> {
  const { error } = await supabase
    .from('system_settings')
    .upsert({ key, value }, { onConflict: 'key' });
  if (error) throw error;
}
