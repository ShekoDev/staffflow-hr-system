import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Image, Layout, Palette, Save, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import { useSettings } from '@/providers/SettingsProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { updateSetting } from '@/services/settings.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Switch } from '@/components/ui/Field';
import type { ColorMode, Language, SystemSettingsMap } from '@/types/models';

export function SettingsPage() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const { settings, refetch } = useSettings();
  const { themes } = useTheme();

  const [draft, setDraft] = useState<SystemSettingsMap>(settings);

  useEffect(() => setDraft(settings), [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await Promise.all([
        updateSetting('branding', draft.branding),
        updateSetting('pdf_branding', draft.pdf_branding),
        updateSetting('appearance', draft.appearance),
        updateSetting('splash', draft.splash),
      ]);
    },
    onSuccess: () => {
      toast.success(t('settings.saved'));
      refetch();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const patch = <K extends keyof SystemSettingsMap>(
    key: K,
    value: Partial<SystemSettingsMap[K]>,
  ) => setDraft((current) => ({ ...current, [key]: { ...current[key], ...value } }));

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        actions={
          <Button
            leftIcon={<Save size={16} />}
            loading={saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {t('common.save')}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('settings.branding')} subtitle={t('common.appSubtitle')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('settings.companyNameEn')}
              value={draft.branding.company_name_en}
              onChange={(e) => patch('branding', { company_name_en: e.target.value })}
            />
            <Input
              label={t('settings.companyNameAr')}
              value={draft.branding.company_name_ar}
              onChange={(e) => patch('branding', { company_name_ar: e.target.value })}
              dir="rtl"
            />
            <Input
              label={t('settings.systemNameEn')}
              value={draft.branding.system_name_en}
              onChange={(e) => patch('branding', { system_name_en: e.target.value })}
            />
            <Input
              label={t('settings.systemNameAr')}
              value={draft.branding.system_name_ar}
              onChange={(e) => patch('branding', { system_name_ar: e.target.value })}
              dir="rtl"
            />
            <Input
              label={t('settings.logoUrl')}
              value={draft.branding.logo_url ?? ''}
              onChange={(e) => patch('branding', { logo_url: e.target.value || null })}
              placeholder="https://…"
              dir="ltr"
              icon={<Image size={15} />}
              wrapperClassName="sm:col-span-2"
            />
          </div>
        </Card>

        <Card>
          <CardHeader title={t('settings.pdfBranding')} />
          <div className="grid gap-4">
            <Input
              label={t('settings.pdfFooterAr')}
              value={draft.pdf_branding.footer_text_ar}
              onChange={(e) => patch('pdf_branding', { footer_text_ar: e.target.value })}
              dir="rtl"
            />
            <Input
              label={t('settings.pdfFooterEn')}
              value={draft.pdf_branding.footer_text_en}
              onChange={(e) => patch('pdf_branding', { footer_text_en: e.target.value })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                type="color"
                label={t('settings.accentColor')}
                value={draft.pdf_branding.accent_color}
                onChange={(e) => patch('pdf_branding', { accent_color: e.target.value })}
                className="h-11 cursor-pointer p-1"
              />
              <div className="flex items-end pb-2">
                <Switch
                  checked={draft.pdf_branding.show_logo}
                  onChange={(next) => patch('pdf_branding', { show_logo: next })}
                  label={t('settings.logoUrl')}
                />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('settings.appearance')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={t('settings.defaultTheme')}
              value={draft.appearance.default_theme}
              onChange={(e) => patch('appearance', { default_theme: e.target.value })}
            >
              {themes.map((theme) => (
                <option key={theme.key} value={theme.key}>
                  {localized(theme.name_en, theme.name_ar)}
                </option>
              ))}
            </Select>
            <Select
              label={t('settings.defaultColorMode')}
              value={draft.appearance.default_color_mode}
              onChange={(e) =>
                patch('appearance', { default_color_mode: e.target.value as ColorMode })
              }
            >
              <option value="light">{t('theme.light')}</option>
              <option value="dark">{t('theme.dark')}</option>
              <option value="system">{t('theme.system')}</option>
            </Select>
            <Select
              label={t('settings.defaultLanguage')}
              value={draft.appearance.default_language}
              onChange={(e) =>
                patch('appearance', { default_language: e.target.value as Language })
              }
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </Select>
            <div className="space-y-3 sm:col-span-2">
              <Switch
                checked={draft.appearance.allow_user_theme}
                onChange={(next) => patch('appearance', { allow_user_theme: next })}
                label={t('settings.allowUserTheme')}
              />
              <Switch
                checked={draft.appearance.allow_user_language}
                onChange={(next) => patch('appearance', { allow_user_language: next })}
                label={t('settings.allowUserLanguage')}
              />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title={t('settings.splash')} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Switch
                checked={draft.splash.enabled}
                onChange={(next) => patch('splash', { enabled: next })}
                label={t('settings.splashEnabled')}
              />
            </div>
            <Input
              type="number"
              label={t('settings.splashDuration')}
              value={draft.splash.duration_ms}
              onChange={(e) => patch('splash', { duration_ms: Number(e.target.value) || 0 })}
              min={600}
              max={8000}
              step={100}
            />
            <Select
              label={t('settings.splashMedia')}
              value={draft.splash.media_type}
              onChange={(e) =>
                patch('splash', {
                  media_type: e.target.value as SystemSettingsMap['splash']['media_type'],
                })
              }
            >
              <option value="placeholder">Placeholder</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </Select>
            <Input
              label={t('settings.splashMediaUrl')}
              value={draft.splash.media_url ?? ''}
              onChange={(e) => patch('splash', { media_url: e.target.value || null })}
              placeholder="https://…"
              dir="ltr"
              icon={<Sparkles size={15} />}
              wrapperClassName="sm:col-span-2"
            />
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title={t('theme.chooseTheme')} subtitle={t('nav.themes')} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {themes.map((theme) => (
            <div key={theme.key} className="rounded-theme-sm border border-line p-3">
              <div className="mb-2 flex items-center gap-2">
                <Palette size={14} className="text-content-muted" />
                <span className="text-sm font-semibold text-content">
                  {localized(theme.name_en, theme.name_ar)}
                </span>
              </div>
              <div className="flex gap-1.5">
                {['primary', 'accent', 'success', 'warning', 'danger'].map((token) => (
                  <span
                    key={token}
                    className="h-6 flex-1 rounded"
                    style={{ background: theme.tokens_light?.[token] ?? '#ccc' }}
                    title={token}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex gap-1.5">
                {['bg', 'surface', 'surface-2', 'border', 'text'].map((token) => (
                  <span
                    key={token}
                    className="h-4 flex-1 rounded border border-line"
                    style={{ background: theme.tokens_dark?.[token] ?? '#222' }}
                    title={`dark: ${token}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-content-muted">
          <Layout size={13} />
          {t('users.rolePermissionsHint')}
        </p>
      </Card>
    </>
  );
}
