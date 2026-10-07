import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Award, Pencil, Plus, Trash2, Trophy, Type } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import { useTheme } from '@/providers/ThemeProvider';
import {
  deleteCustomizationRow,
  fetchAllBadges,
  fetchAllFrames,
  fetchAllNameColorRules,
  fetchAllThemes,
  saveCustomizationRow,
} from '@/services/customization.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Switch } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { initialsOf } from '@/lib/appearance';
import type { Badge, NameColorRule, ProfileFrame } from '@/types/models';

export type CustomizationTab = 'themes' | 'frames' | 'badges' | 'colors';

const CONDITIONS = ['', 'employee_of_month', 'top_performer', 'perfect_attendance', 'new_employee'];
const ROLE_KEYS = ['', 'admin', 'hr', 'manager', 'employee'];

export function CustomizationPage({ tab }: { tab: CustomizationTab }) {
  const { t } = useI18n();

  const titles: Record<CustomizationTab, { title: string; subtitle: string }> = {
    themes: { title: t('customization.themes'), subtitle: t('customization.themesSubtitle') },
    frames: { title: t('customization.frames'), subtitle: t('customization.framesSubtitle') },
    badges: { title: t('customization.badges'), subtitle: t('customization.badgesSubtitle') },
    colors: {
      title: t('customization.nameColors'),
      subtitle: t('customization.nameColorsSubtitle'),
    },
  };

  return (
    <>
      <PageHeader title={titles[tab].title} subtitle={titles[tab].subtitle} />
      {tab === 'themes' && <ThemesTab />}
      {tab === 'frames' && <FramesTab />}
      {tab === 'badges' && <BadgesTab />}
      {tab === 'colors' && <ColorsTab />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Themes                                                              */
/* ------------------------------------------------------------------ */

function ThemesTab() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { themeKey, setThemeKey } = useTheme();

  const { data: themes = [], isLoading } = useQuery({
    queryKey: ['all-themes'],
    queryFn: fetchAllThemes,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      saveCustomizationRow('themes', { is_active: isActive }, id),
    onSuccess: () => {
      toast.success(t('customization.saved'));
      void queryClient.invalidateQueries({ queryKey: ['all-themes'] });
      void queryClient.invalidateQueries({ queryKey: ['themes'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <Skeleton className="h-32 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <p className="mb-4 text-sm text-content-muted">{t('customization.tokensHint')}</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme) => (
          <Card key={theme.id} className="animate-fade-up">
            <CardHeader
              title={localized(theme.name_en, theme.name_ar)}
              subtitle={theme.key}
              action={
                theme.key === themeKey ? (
                  <Pill tone="primary">{t('common.active')}</Pill>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setThemeKey(theme.key)}>
                    {t('common.apply')}
                  </Button>
                )
              }
            />

            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-content-muted">
              {t('customization.lightTokens')}
            </p>
            <div className="flex gap-1.5">
              {['primary', 'accent', 'bg', 'surface', 'text', 'success', 'danger'].map((token) => (
                <span
                  key={token}
                  title={token}
                  className="h-7 flex-1 rounded border border-line"
                  style={{ background: theme.tokens_light?.[token] ?? '#ccc' }}
                />
              ))}
            </div>

            <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-wide text-content-muted">
              {t('customization.darkTokens')}
            </p>
            <div className="flex gap-1.5">
              {['primary', 'accent', 'bg', 'surface', 'text', 'success', 'danger'].map((token) => (
                <span
                  key={token}
                  title={token}
                  className="h-7 flex-1 rounded border border-line"
                  style={{ background: theme.tokens_dark?.[token] ?? '#222' }}
                />
              ))}
            </div>

            <div className="mt-4 border-t border-line pt-3">
              <Switch
                checked={theme.is_active}
                onChange={(next) => toggleMutation.mutate({ id: theme.id, isActive: next })}
                label={t('common.active')}
              />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

interface FrameDraft {
  key: string;
  name_en: string;
  name_ar: string;
  css_gradient: string;
  ring_width: number;
  glow_color: string;
  auto_role_key: string;
  auto_condition: string;
  priority: number;
  is_active: boolean;
}

const EMPTY_FRAME: FrameDraft = {
  key: '',
  name_en: '',
  name_ar: '',
  css_gradient: 'linear-gradient(135deg,#93c5fd,#3b82f6)',
  ring_width: 3,
  glow_color: '',
  auto_role_key: '',
  auto_condition: '',
  priority: 100,
  is_active: true,
};

function FramesTab() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: frames = [], isLoading } = useQuery({
    queryKey: ['all-frames'],
    queryFn: fetchAllFrames,
  });

  const [editing, setEditing] = useState<ProfileFrame | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FrameDraft>(EMPTY_FRAME);
  const [pendingDelete, setPendingDelete] = useState<ProfileFrame | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(
      editing
        ? {
            key: editing.key,
            name_en: editing.name_en,
            name_ar: editing.name_ar,
            css_gradient: editing.css_gradient ?? '',
            ring_width: editing.ring_width,
            glow_color: editing.glow_color ?? '',
            auto_role_key: editing.auto_role_key ?? '',
            auto_condition: editing.auto_condition ?? '',
            priority: editing.priority,
            is_active: editing.is_active,
          }
        : EMPTY_FRAME,
    );
  }, [open, editing]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['all-frames'] });
    void queryClient.invalidateQueries({ queryKey: ['frames'] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      saveCustomizationRow(
        'profile_frames',
        {
          ...draft,
          glow_color: draft.glow_color || null,
          auto_role_key: draft.auto_role_key || null,
          auto_condition: draft.auto_condition || null,
        },
        editing?.id,
      ),
    onSuccess: () => {
      toast.success(t('customization.saved'));
      invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (frame: ProfileFrame) =>
      deleteCustomizationRow('profile_frames', frame.id, frame.key),
    onSuccess: () => {
      toast.success(t('customization.deleted'));
      invalidate();
      setPendingDelete(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          leftIcon={<Plus size={16} />}
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          {t('customization.newFrame')}
        </Button>
      </div>

      {frames.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<Award size={24} />} title={t('common.noResults')} />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {frames.map((frame) => (
            <Card key={frame.id} className="animate-fade-up">
              <div className="flex items-center gap-4">
                <FramePreview frame={frame} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-content">
                    {localized(frame.name_en, frame.name_ar)}
                  </p>
                  <p className="truncate text-xs text-content-muted">{frame.key}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {frame.auto_role_key && <Pill tone="primary">{frame.auto_role_key}</Pill>}
                    {frame.auto_condition && <Pill tone="warning">{frame.auto_condition}</Pill>}
                    <Pill tone="neutral">#{frame.priority}</Pill>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('common.edit')}
                    onClick={() => {
                      setEditing(frame);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-danger"
                    aria-label={t('common.delete')}
                    onClick={() => setPendingDelete(frame)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('common.edit') : t('customization.newFrame')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="mb-5 flex items-center justify-center rounded-theme-sm bg-surface-alt py-6">
          <FramePreview
            frame={{
              ...EMPTY_FRAME,
              ...draft,
              id: 'preview',
              icon: null,
              glow_color: draft.glow_color || null,
              auto_role_key: null,
              auto_condition: null,
            }}
            large
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('customization.key')}
            value={draft.key}
            onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            dir="ltr"
            required
          />
          <Input
            label={t('customization.priority')}
            type="number"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })}
            hint={t('customization.priorityHint')}
          />
          <Input
            label={t('departments.nameEn')}
            value={draft.name_en}
            onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
            required
          />
          <Input
            label={t('departments.nameAr')}
            value={draft.name_ar}
            onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
            dir="rtl"
            required
          />
          <Input
            label={t('customization.gradient')}
            value={draft.css_gradient}
            onChange={(e) => setDraft({ ...draft, css_gradient: e.target.value })}
            dir="ltr"
            wrapperClassName="sm:col-span-2"
          />
          <Input
            label={t('customization.ringWidth')}
            type="number"
            min={1}
            max={8}
            value={draft.ring_width}
            onChange={(e) => setDraft({ ...draft, ring_width: Number(e.target.value) || 1 })}
          />
          <Input
            label={t('customization.glow')}
            value={draft.glow_color}
            onChange={(e) => setDraft({ ...draft, glow_color: e.target.value })}
            placeholder="#f59e0b"
            dir="ltr"
          />
          <Select
            label={t('customization.autoRole')}
            value={draft.auto_role_key}
            onChange={(e) => setDraft({ ...draft, auto_role_key: e.target.value })}
          >
            {ROLE_KEYS.map((role) => (
              <option key={role} value={role}>
                {role || t('customization.conditionNone')}
              </option>
            ))}
          </Select>
          <ConditionSelect
            value={draft.auto_condition}
            onChange={(value) => setDraft({ ...draft, auto_condition: value })}
          />
          <div className="sm:col-span-2">
            <Switch
              checked={draft.is_active}
              onChange={(next) => setDraft({ ...draft, is_active: next })}
              label={t('common.active')}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('customization.deleteConfirm')}
        description={t('customization.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        loading={removeMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeMutation.mutate(pendingDelete)}
      />
    </>
  );
}

function FramePreview({ frame, large = false }: { frame: ProfileFrame; large?: boolean }) {
  const size = large ? 96 : 52;
  const ring = frame.ring_width ?? 3;
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background: frame.css_gradient ?? 'var(--sf-border)',
        boxShadow: frame.glow_color
          ? `0 0 0 1px ${frame.glow_color}22, 0 0 16px -2px ${frame.glow_color}90`
          : undefined,
      }}
    >
      <span
        className="flex items-center justify-center rounded-full bg-surface font-bold text-content-muted"
        style={{ width: size - ring * 2, height: size - ring * 2, fontSize: size * 0.3 }}
      >
        {initialsOf('Ahmed Ali')}
      </span>
    </span>
  );
}

function ConditionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const labels: Record<string, string> = {
    '': t('customization.conditionNone'),
    employee_of_month: t('customization.conditionEom'),
    top_performer: t('customization.conditionTop'),
    perfect_attendance: t('customization.conditionPerfect'),
    new_employee: t('customization.conditionNew'),
  };
  return (
    <Select
      label={t('customization.autoCondition')}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {CONDITIONS.map((condition) => (
        <option key={condition} value={condition}>
          {labels[condition]}
        </option>
      ))}
    </Select>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

interface BadgeDraft {
  key: string;
  name_en: string;
  name_ar: string;
  icon: string;
  color: string;
  auto_role_key: string;
  auto_condition: string;
  priority: number;
  is_active: boolean;
}

const EMPTY_BADGE: BadgeDraft = {
  key: '',
  name_en: '',
  name_ar: '',
  icon: '⭐',
  color: '#2563eb',
  auto_role_key: '',
  auto_condition: '',
  priority: 100,
  is_active: true,
};

function BadgesTab() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['all-badges'],
    queryFn: fetchAllBadges,
  });

  const [editing, setEditing] = useState<Badge | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BadgeDraft>(EMPTY_BADGE);
  const [pendingDelete, setPendingDelete] = useState<Badge | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(
      editing
        ? {
            key: editing.key,
            name_en: editing.name_en,
            name_ar: editing.name_ar,
            icon: editing.icon ?? '',
            color: editing.color ?? '#2563eb',
            auto_role_key: editing.auto_role_key ?? '',
            auto_condition: editing.auto_condition ?? '',
            priority: editing.priority,
            is_active: editing.is_active,
          }
        : EMPTY_BADGE,
    );
  }, [open, editing]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['all-badges'] });
    void queryClient.invalidateQueries({ queryKey: ['badges'] });
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      saveCustomizationRow(
        'badges',
        {
          ...draft,
          auto_role_key: draft.auto_role_key || null,
          auto_condition: draft.auto_condition || null,
        },
        editing?.id,
      ),
    onSuccess: () => {
      toast.success(t('customization.saved'));
      invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (badge: Badge) => deleteCustomizationRow('badges', badge.id, badge.key),
    onSuccess: () => {
      toast.success(t('customization.deleted'));
      invalidate();
      setPendingDelete(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          leftIcon={<Plus size={16} />}
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          {t('customization.newBadge')}
        </Button>
      </div>

      {badges.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<Trophy size={24} />} title={t('common.noResults')} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {badges.map((badge) => (
            <Card key={badge.id} className="animate-fade-up">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                  style={{
                    background: `color-mix(in srgb, ${badge.color ?? '#2563eb'} 16%, transparent)`,
                  }}
                >
                  {badge.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-content" style={{ color: badge.color ?? undefined }}>
                    {localized(badge.name_en, badge.name_ar)}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {badge.auto_role_key && <Pill tone="primary">{badge.auto_role_key}</Pill>}
                    {badge.auto_condition && <Pill tone="warning">{badge.auto_condition}</Pill>}
                    <Pill tone="neutral">#{badge.priority}</Pill>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('common.edit')}
                    onClick={() => {
                      setEditing(badge);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-danger"
                    aria-label={t('common.delete')}
                    onClick={() => setPendingDelete(badge)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('common.edit') : t('customization.newBadge')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="mb-5 flex items-center justify-center gap-2 rounded-theme-sm bg-surface-alt py-5">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"
            style={{
              background: `color-mix(in srgb, ${draft.color} 15%, transparent)`,
              color: draft.color,
            }}
          >
            <span>{draft.icon}</span>
            {draft.name_en || t('customization.livePreview')}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('customization.key')}
            value={draft.key}
            onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            dir="ltr"
            required
          />
          <Input
            label={t('customization.icon')}
            value={draft.icon}
            onChange={(e) => setDraft({ ...draft, icon: e.target.value })}
          />
          <Input
            label={t('departments.nameEn')}
            value={draft.name_en}
            onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
            required
          />
          <Input
            label={t('departments.nameAr')}
            value={draft.name_ar}
            onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
            dir="rtl"
            required
          />
          <Input
            type="color"
            label={t('customization.color')}
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            className="h-11 cursor-pointer p-1"
          />
          <Input
            label={t('customization.priority')}
            type="number"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })}
          />
          <Select
            label={t('customization.autoRole')}
            value={draft.auto_role_key}
            onChange={(e) => setDraft({ ...draft, auto_role_key: e.target.value })}
          >
            {ROLE_KEYS.map((role) => (
              <option key={role} value={role}>
                {role || t('customization.conditionNone')}
              </option>
            ))}
          </Select>
          <ConditionSelect
            value={draft.auto_condition}
            onChange={(value) => setDraft({ ...draft, auto_condition: value })}
          />
          <div className="sm:col-span-2">
            <Switch
              checked={draft.is_active}
              onChange={(next) => setDraft({ ...draft, is_active: next })}
              label={t('common.active')}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('customization.deleteConfirm')}
        description={t('customization.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        loading={removeMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeMutation.mutate(pendingDelete)}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Name colour rules                                                   */
/* ------------------------------------------------------------------ */

interface RuleDraft {
  key: string;
  name_en: string;
  name_ar: string;
  color: string;
  condition_type: 'role' | 'status';
  condition_value: string;
  priority: number;
  is_active: boolean;
}

const EMPTY_RULE: RuleDraft = {
  key: '',
  name_en: '',
  name_ar: '',
  color: '#2563eb',
  condition_type: 'role',
  condition_value: 'employee',
  priority: 100,
  is_active: true,
};

function ColorsTab() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['all-color-rules'],
    queryFn: fetchAllNameColorRules,
  });

  const [editing, setEditing] = useState<NameColorRule | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_RULE);
  const [pendingDelete, setPendingDelete] = useState<NameColorRule | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(
      editing
        ? {
            key: editing.key,
            name_en: editing.name_en,
            name_ar: editing.name_ar,
            color: editing.color || '#2563eb',
            condition_type: editing.condition_type,
            condition_value: editing.condition_value,
            priority: editing.priority,
            is_active: editing.is_active,
          }
        : EMPTY_RULE,
    );
  }, [open, editing]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['all-color-rules'] });
    void queryClient.invalidateQueries({ queryKey: ['name-color-rules'] });
  };

  const saveMutation = useMutation({
    mutationFn: () => saveCustomizationRow('name_color_rules', { ...draft }, editing?.id),
    onSuccess: () => {
      toast.success(t('customization.saved'));
      invalidate();
      setOpen(false);
      setEditing(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const removeMutation = useMutation({
    mutationFn: (rule: NameColorRule) =>
      deleteCustomizationRow('name_color_rules', rule.id, rule.key),
    onSuccess: () => {
      toast.success(t('customization.deleted'));
      invalidate();
      setPendingDelete(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const statusValues = ['employee_of_month', 'top_performer', 'perfect_attendance', 'new_employee'];

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-content-muted">{t('customization.priorityHint')}</p>
        <Button
          leftIcon={<Plus size={16} />}
          onClick={() => {
            setEditing(null);
            setOpen(true);
          }}
        >
          {t('customization.newRule')}
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card padded={false}>
          <EmptyState icon={<Type size={24} />} title={t('common.noResults')} />
        </Card>
      ) : (
        <Card padded={false}>
          <ul className="divide-y divide-line">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="w-10 shrink-0 text-center text-sm font-extrabold text-content-muted">
                  #{rule.priority}
                </span>
                <div className="min-w-[10rem] flex-1">
                  <p className="font-semibold" style={{ color: rule.color || undefined }}>
                    {localized(rule.name_en, rule.name_ar)}
                  </p>
                  <p className="text-xs text-content-muted">
                    {rule.condition_type === 'role'
                      ? t('customization.conditionRole')
                      : t('customization.conditionStatus')}
                    : {rule.condition_value}
                  </p>
                </div>
                <span
                  className="h-6 w-10 rounded border border-line"
                  style={{ background: rule.color || 'transparent' }}
                />
                <Pill tone={rule.is_active ? 'success' : 'neutral'}>
                  {rule.is_active ? t('common.active') : t('common.inactive')}
                </Pill>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('common.edit')}
                    onClick={() => {
                      setEditing(rule);
                      setOpen(true);
                    }}
                  >
                    <Pencil size={15} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-danger"
                    aria-label={t('common.delete')}
                    onClick={() => setPendingDelete(rule)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('common.edit') : t('customization.newRule')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="mb-5 rounded-theme-sm bg-surface-alt py-5 text-center">
          <span className="text-lg font-bold" style={{ color: draft.color }}>
            {draft.name_en || 'Ahmed Mohamed'}
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('customization.key')}
            value={draft.key}
            onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            dir="ltr"
            required
          />
          <Input
            label={t('customization.priority')}
            type="number"
            value={draft.priority}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) || 0 })}
          />
          <Input
            label={t('departments.nameEn')}
            value={draft.name_en}
            onChange={(e) => setDraft({ ...draft, name_en: e.target.value })}
            required
          />
          <Input
            label={t('departments.nameAr')}
            value={draft.name_ar}
            onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })}
            dir="rtl"
            required
          />
          <Input
            type="color"
            label={t('customization.color')}
            value={draft.color}
            onChange={(e) => setDraft({ ...draft, color: e.target.value })}
            className="h-11 cursor-pointer p-1"
          />
          <Select
            label={t('customization.autoCondition')}
            value={draft.condition_type}
            onChange={(e) =>
              setDraft({
                ...draft,
                condition_type: e.target.value as 'role' | 'status',
                condition_value: e.target.value === 'role' ? 'employee' : 'employee_of_month',
              })
            }
          >
            <option value="role">{t('customization.conditionRole')}</option>
            <option value="status">{t('customization.conditionStatus')}</option>
          </Select>
          <Select
            label={t('common.status')}
            value={draft.condition_value}
            onChange={(e) => setDraft({ ...draft, condition_value: e.target.value })}
            wrapperClassName="sm:col-span-2"
          >
            {(draft.condition_type === 'role'
              ? ROLE_KEYS.filter(Boolean)
              : statusValues
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <div className="sm:col-span-2">
            <Switch
              checked={draft.is_active}
              onChange={(next) => setDraft({ ...draft, is_active: next })}
              label={t('common.active')}
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('customization.deleteConfirm')}
        description={t('customization.deleteConfirmBody')}
        confirmLabel={t('common.delete')}
        loading={removeMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeMutation.mutate(pendingDelete)}
      />
    </>
  );
}
