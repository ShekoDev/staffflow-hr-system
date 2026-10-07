import type { Language } from '@/types/models';

export function formatDate(value: string | null | undefined, language: Language = 'en'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
}

export function formatDateTime(value: string | null | undefined, language: Language = 'en'): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatNumber(value: number, language: Language = 'en'): string {
  return new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US').format(value);
}

export function formatPercent(value: number, language: Language = 'en'): string {
  return `${new Intl.NumberFormat(language === 'ar' ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(value)}%`;
}

export function monthName(month: number, language: Language = 'en'): string {
  const date = new Date(2000, Math.max(0, month - 1), 1);
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' }).format(date);
}

/** Greeting key based on the local hour. */
export function greetingKey(): 'goodMorning' | 'goodAfternoon' | 'goodEvening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'goodMorning';
  if (hour < 17) return 'goodAfternoon';
  return 'goodEvening';
}
