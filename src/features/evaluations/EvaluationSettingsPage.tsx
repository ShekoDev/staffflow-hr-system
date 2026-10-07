import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Save, Scale } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import {
  EVALUATION_STAGES,
  fetchDefaultTemplate,
  fetchStageWeights,
  saveStageWeights,
} from '@/services/evaluations.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Switch } from '@/components/ui/Field';
import { ProgressBar } from '@/components/ui/Progress';
import { Pill } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { EvaluationStage } from '@/types/models';

interface StageDraft {
  stage: EvaluationStage;
  weight: number;
  is_enabled: boolean;
}

export function EvaluationSettingsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: template } = useQuery({
    queryKey: ['evaluation-template'],
    queryFn: fetchDefaultTemplate,
  });
  const { data, isLoading } = useQuery({
    queryKey: ['stage-weights', template?.id],
    queryFn: () => fetchStageWeights(template?.id as string),
    enabled: Boolean(template?.id),
  });

  // Stable reference so the effect below does not re-run on every render.
  const stored = useMemo(() => data ?? [], [data]);
  const [draft, setDraft] = useState<StageDraft[]>([]);

  useEffect(() => {
    setDraft(
      EVALUATION_STAGES.map((stage) => {
        const row = stored.find((w) => w.stage === stage);
        return {
          stage,
          weight: row ? Number(row.weight) : 0,
          is_enabled: row?.is_enabled ?? false,
        };
      }),
    );
  }, [stored]);

  const enabledTotal = draft
    .filter((row) => row.is_enabled)
    .reduce((sum, row) => sum + row.weight, 0);

  const mutation = useMutation({
    mutationFn: () => saveStageWeights(template?.id as string, draft),
    onSuccess: () => {
      toast.success(t('evaluations.stagesSaved'));
      void queryClient.invalidateQueries({ queryKey: ['stage-weights'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  const stageLabel = (stage: EvaluationStage) =>
    ({
      manager: t('evaluations.stageManager'),
      administrative: t('evaluations.stageAdministrative'),
      self: t('evaluations.stageSelf'),
      peer: t('evaluations.stagePeer'),
    })[stage];

  const patch = (stage: EvaluationStage, changes: Partial<StageDraft>) =>
    setDraft((current) =>
      current.map((row) => (row.stage === stage ? { ...row, ...changes } : row)),
    );

  return (
    <>
      <PageHeader
        title={t('evaluations.settings')}
        subtitle={t('evaluations.settingsSubtitle')}
        actions={
          <Button
            leftIcon={<Save size={16} />}
            loading={mutation.isPending}
            disabled={!template}
            onClick={() => mutation.mutate()}
          >
            {t('common.save')}
          </Button>
        }
      />

      <Card className="max-w-3xl">
        <CardHeader
          title={t('evaluations.stage')}
          subtitle={t('evaluations.settingsSubtitle')}
          action={
            enabledTotal === 100 ? (
              <Pill tone="success">100%</Pill>
            ) : (
              <Pill tone="warning" icon={<AlertTriangle size={12} />}>
                {enabledTotal}%
              </Pill>
            )
          }
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {draft.map((row) => (
              <div
                key={row.stage}
                className="flex flex-wrap items-center gap-4 rounded-theme-sm border border-line px-3 py-3"
              >
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-semibold text-content">{stageLabel(row.stage)}</p>
                  <ProgressBar
                    value={row.is_enabled ? row.weight : 0}
                    className="mt-2 max-w-xs"
                    color={row.is_enabled ? undefined : 'var(--sf-border)'}
                  />
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={row.weight}
                  disabled={!row.is_enabled}
                  onChange={(e) => patch(row.stage, { weight: Number(e.target.value) || 0 })}
                  className="h-9 w-24 py-0 text-sm"
                  wrapperClassName="w-24"
                />
                <Switch
                  checked={row.is_enabled}
                  onChange={(next) => patch(row.stage, { is_enabled: next })}
                  label={t('evaluations.stageEnabled')}
                />
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 flex items-start gap-2 rounded-theme-sm bg-surface-alt p-3 text-xs leading-relaxed text-content-muted">
          <Scale size={14} className="mt-0.5 shrink-0" />
          {t('evaluations.settingsSubtitle')} — {t('customization.priorityHint')}
        </p>
      </Card>
    </>
  );
}
