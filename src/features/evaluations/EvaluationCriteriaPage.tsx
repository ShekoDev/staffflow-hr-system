import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import {
  EVALUATION_STAGES,
  deleteCriterion,
  fetchCriteria,
  fetchDefaultTemplate,
  saveCriterion,
  type CriterionInput,
} from '@/services/evaluations.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Input, Select, Switch, Textarea } from '@/components/ui/Field';
import { Pill } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/ui/Progress';
import type { EvaluationCriterion, EvaluationStage } from '@/types/models';

const EMPTY: CriterionInput = {
  template_id: null,
  key: null,
  name_en: '',
  name_ar: '',
  description: null,
  max_score: 10,
  weight: 10,
  stage: 'manager',
  sort_order: 0,
  is_active: true,
};

export function EvaluationCriteriaPage() {
  const { t, localized } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: template } = useQuery({
    queryKey: ['evaluation-template'],
    queryFn: fetchDefaultTemplate,
  });
  const { data: criteria = [], isLoading } = useQuery({
    queryKey: ['evaluation-criteria', template?.id],
    queryFn: () => fetchCriteria(template?.id),
    enabled: Boolean(template?.id),
  });

  const [editing, setEditing] = useState<EvaluationCriterion | null>(null);
  const [open, setOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<EvaluationCriterion | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<EvaluationStage, EvaluationCriterion[]>();
    for (const stage of EVALUATION_STAGES) map.set(stage, []);
    for (const criterion of criteria) {
      map.get(criterion.stage)?.push(criterion);
    }
    return map;
  }, [criteria]);

  const stageLabel = (stage: EvaluationStage) =>
    ({
      manager: t('evaluations.stageManager'),
      administrative: t('evaluations.stageAdministrative'),
      self: t('evaluations.stageSelf'),
      peer: t('evaluations.stagePeer'),
    })[stage];

  const removeMutation = useMutation({
    mutationFn: (criterion: EvaluationCriterion) =>
      deleteCriterion(criterion.id, criterion.name_en),
    onSuccess: () => {
      toast.success(t('customization.deleted'));
      void queryClient.invalidateQueries({ queryKey: ['evaluation-criteria'] });
      setPendingDelete(null);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <>
      <PageHeader
        title={t('evaluations.criteria')}
        subtitle={t('evaluations.criteriaSubtitle')}
        actions={
          <Button
            leftIcon={<Plus size={16} />}
            onClick={() => {
              setEditing(null);
              setOpen(true);
            }}
          >
            {t('evaluations.newCriterion')}
          </Button>
        }
      />

      {isLoading ? (
        <Card>
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="mt-4 h-24 w-full" />
        </Card>
      ) : (
        <div className="space-y-4">
          {EVALUATION_STAGES.map((stage) => {
            const list = grouped.get(stage) ?? [];
            const totalWeight = list
              .filter((c) => c.is_active)
              .reduce((sum, c) => sum + Number(c.weight), 0);

            return (
              <Card key={stage}>
                <CardHeader
                  title={stageLabel(stage)}
                  subtitle={`${t('evaluations.totalWeight')}: ${totalWeight}%`}
                  action={
                    totalWeight !== 100 && list.length > 0 ? (
                      <Pill tone="warning" icon={<AlertTriangle size={12} />}>
                        {t('evaluations.weightWarning')}
                      </Pill>
                    ) : list.length > 0 ? (
                      <Pill tone="success">100%</Pill>
                    ) : null
                  }
                />

                {list.length === 0 ? (
                  <p className="py-3 text-sm text-content-muted">{t('evaluations.noCriteria')}</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((criterion) => (
                      <li
                        key={criterion.id}
                        className="flex flex-wrap items-center gap-3 rounded-theme-sm border border-line px-3 py-2.5"
                      >
                        <div className="min-w-[12rem] flex-1">
                          <p className="text-sm font-semibold text-content">
                            {localized(criterion.name_en, criterion.name_ar)}
                          </p>
                          <p className="text-xs text-content-muted">
                            {t('evaluations.maxScore')}: {criterion.max_score}
                          </p>
                        </div>
                        <div className="w-40">
                          <ProgressBar value={Number(criterion.weight)} showLabel />
                        </div>
                        <Pill tone={criterion.is_active ? 'success' : 'neutral'}>
                          {criterion.is_active ? t('common.active') : t('common.inactive')}
                        </Pill>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={t('common.edit')}
                            onClick={() => {
                              setEditing(criterion);
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
                            onClick={() => setPendingDelete(criterion)}
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}

          {criteria.length === 0 && (
            <Card padded={false}>
              <EmptyState
                icon={<ListChecks size={24} />}
                title={t('evaluations.noCriteria')}
                description={t('evaluations.noCriteriaBody')}
              />
            </Card>
          )}
        </div>
      )}

      <CriterionModal
        open={open}
        criterion={editing}
        templateId={template?.id ?? null}
        nextOrder={criteria.length + 1}
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={t('evaluations.deleteCriterion')}
        description={t('evaluations.deleteCriterionBody')}
        confirmLabel={t('common.delete')}
        loading={removeMutation.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeMutation.mutate(pendingDelete)}
      />
    </>
  );
}

function CriterionModal({
  open,
  criterion,
  templateId,
  nextOrder,
  onClose,
}: {
  open: boolean;
  criterion: EvaluationCriterion | null;
  templateId: string | null;
  nextOrder: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CriterionInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      criterion
        ? {
            template_id: criterion.template_id,
            key: criterion.key,
            name_en: criterion.name_en,
            name_ar: criterion.name_ar,
            description: criterion.description,
            max_score: Number(criterion.max_score),
            weight: Number(criterion.weight),
            stage: criterion.stage,
            sort_order: criterion.sort_order,
            is_active: criterion.is_active,
          }
        : { ...EMPTY, template_id: templateId, sort_order: nextOrder },
    );
  }, [open, criterion, templateId, nextOrder]);

  const mutation = useMutation({
    mutationFn: () => saveCriterion({ ...form, template_id: templateId }, criterion?.id),
    onSuccess: () => {
      toast.success(t('evaluations.criterionSaved'));
      void queryClient.invalidateQueries({ queryKey: ['evaluation-criteria'] });
      onClose();
    },
    onError: (err) => setError(err instanceof Error ? err.message : String(err)),
  });

  const stageLabel = (stage: EvaluationStage) =>
    ({
      manager: t('evaluations.stageManager'),
      administrative: t('evaluations.stageAdministrative'),
      self: t('evaluations.stageSelf'),
      peer: t('evaluations.stagePeer'),
    })[stage];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={criterion ? t('evaluations.editCriterion') : t('evaluations.newCriterion')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t('evaluations.criterionNameEn')}
          value={form.name_en}
          onChange={(e) => setForm({ ...form, name_en: e.target.value })}
          required
        />
        <Input
          label={t('evaluations.criterionNameAr')}
          value={form.name_ar}
          onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
          dir="rtl"
          required
        />
        <Select
          label={t('evaluations.stage')}
          value={form.stage}
          onChange={(e) => setForm({ ...form, stage: e.target.value as EvaluationStage })}
        >
          {EVALUATION_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              {stageLabel(stage)}
            </option>
          ))}
        </Select>
        <Input
          type="number"
          label={t('evaluations.maxScore')}
          value={form.max_score}
          min={1}
          onChange={(e) => setForm({ ...form, max_score: Number(e.target.value) || 1 })}
        />
        <Input
          type="number"
          label={t('evaluations.weight')}
          value={form.weight}
          min={0}
          max={100}
          onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 0 })}
        />
        <Input
          type="number"
          label={t('evaluations.sortOrder')}
          value={form.sort_order}
          onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })}
        />
        <Textarea
          label={t('departments.description')}
          value={form.description ?? ''}
          onChange={(e) => setForm({ ...form, description: e.target.value || null })}
          wrapperClassName="sm:col-span-2"
        />
        <div className="sm:col-span-2">
          <Switch
            checked={form.is_active}
            onChange={(next) => setForm({ ...form, is_active: next })}
            label={t('common.active')}
          />
        </div>
        {error && (
          <p className="rounded-theme-sm border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger sm:col-span-2">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
