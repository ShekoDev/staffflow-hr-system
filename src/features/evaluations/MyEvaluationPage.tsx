import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheck, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/providers/AuthProvider';
import { PERMISSIONS } from '@/lib/permissions';
import {
  combineStages,
  fetchDefaultTemplate,
  fetchEvaluations,
  fetchStageWeights,
} from '@/services/evaluations.service';
import { PageHeader } from '@/components/common/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Pill, type BadgeTone } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/Progress';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatPercent, monthName } from '@/lib/format';
import { EvaluationFormModal, type EvaluationTarget } from './EvaluationForm';
import type { EvaluationStage, EvaluationStatus } from '@/types/models';

const STATUS_TONE: Record<EvaluationStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export function MyEvaluationPage() {
  const { t, language, localized } = useI18n();
  const { profile, can } = useAuth();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selfTarget, setSelfTarget] = useState<EvaluationTarget | null>(null);

  const employee = profile?.employee;

  const { data: template } = useQuery({
    queryKey: ['evaluation-template'],
    queryFn: fetchDefaultTemplate,
  });

  const { data: weights = [] } = useQuery({
    queryKey: ['stage-weights', template?.id],
    queryFn: () => fetchStageWeights(template?.id as string),
    enabled: Boolean(template?.id),
  });

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ['evaluations', 'mine', employee?.id, year, month],
    queryFn: () => fetchEvaluations({ employeeId: employee?.id, year, month }),
    enabled: Boolean(employee?.id),
  });

  const combined = useMemo(() => combineStages(evaluations, weights), [evaluations, weights]);
  const selfEvaluation = evaluations.find((row) => row.stage === 'self');

  const stageLabel = (stage: EvaluationStage) =>
    ({
      manager: t('evaluations.stageManager'),
      administrative: t('evaluations.stageAdministrative'),
      self: t('evaluations.stageSelf'),
      peer: t('evaluations.stagePeer'),
    })[stage];

  const statusLabel = (status: EvaluationStatus) =>
    ({
      draft: t('evaluations.draft'),
      submitted: t('evaluations.statusSubmitted'),
      approved: t('evaluations.statusApproved'),
      rejected: t('evaluations.statusRejected'),
    })[status];

  const selfEnabled =
    can(PERMISSIONS.evaluations.self) &&
    weights.some((w) => w.stage === 'self' && w.is_enabled);

  return (
    <>
      <PageHeader
        title={t('evaluations.myEvaluation')}
        subtitle={t('evaluations.myEvaluationSubtitle')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-10 w-36 py-0 text-sm"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthName(m, language)}
                </option>
              ))}
            </Select>
            <Select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-10 w-28 py-0 text-sm"
            >
              {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            {selfEnabled && employee && (
              <Button
                leftIcon={<Sparkles size={15} />}
                onClick={() =>
                  setSelfTarget({
                    employee,
                    evaluationId: selfEvaluation?.id,
                    comments: selfEvaluation?.comments,
                  })
                }
              >
                {t('evaluations.selfAssessment')}
              </Button>
            )}
          </div>
        }
      />

      {isLoading ? (
        <Card>
          <Skeleton className="h-24 w-full" />
        </Card>
      ) : evaluations.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon={<ClipboardCheck size={24} />}
            title={t('evaluations.noEvaluations')}
            description={t('evaluations.noEvaluationsBody')}
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader title={t('evaluations.finalScore')} />
            <div className="flex flex-col items-center py-4">
              <div
                className="flex h-32 w-32 items-center justify-center rounded-full text-3xl font-extrabold"
                style={{
                  background: `conic-gradient(var(--sf-primary) ${combined.final * 3.6}deg, color-mix(in srgb, var(--sf-text-muted) 15%, transparent) 0)`,
                  color: 'var(--sf-text)',
                }}
              >
                <span className="flex h-24 w-24 items-center justify-center rounded-full bg-surface text-xl">
                  {formatPercent(combined.final, language)}
                </span>
              </div>
              <p className="mt-4 text-center text-xs text-content-muted">
                {monthName(month, language)} {year}
              </p>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader
              title={t('evaluations.title')}
              subtitle={t('evaluations.settingsSubtitle')}
            />
            <div className="space-y-4">
              {combined.breakdown.map((row) => (
                <div key={row.stage}>
                  <div className="mb-1.5 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-content">
                      {stageLabel(row.stage)}
                      <span className="ms-2 text-xs text-content-muted">({row.weight}%)</span>
                    </span>
                    <span className="text-sm font-bold text-content">
                      {formatPercent(row.percentage, language)}
                    </span>
                  </div>
                  <ProgressBar value={row.percentage} />
                </div>
              ))}
              {combined.breakdown.length === 0 && (
                <p className="text-sm text-content-muted">{t('evaluations.noEvaluationsBody')}</p>
              )}
            </div>

            <div className="mt-6 space-y-2 border-t border-line pt-4">
              {evaluations.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-theme-sm border border-line px-3 py-2"
                >
                  <span className="text-sm text-content">{stageLabel(row.stage)}</span>
                  <div className="flex items-center gap-2">
                    <Pill tone={STATUS_TONE[row.status]}>{statusLabel(row.status)}</Pill>
                    <span className="text-sm font-bold text-content">
                      {row.percentage != null ? formatPercent(Number(row.percentage), language) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {evaluations.some((row) => row.comments) && (
              <div className="mt-4 space-y-2">
                {evaluations
                  .filter((row) => row.comments)
                  .map((row) => (
                    <div key={`c-${row.id}`} className="rounded-theme-sm bg-surface-alt p-3">
                      <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-content-muted">
                        {stageLabel(row.stage)}
                      </p>
                      <p className="text-sm text-content-muted">{row.comments}</p>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {employee && (
        <p className="mt-4 text-xs text-content-muted">
          {localized(employee.full_name_en, employee.full_name_ar)} ·{' '}
          {t('evaluations.selfAssessmentHint')}
        </p>
      )}

      <EvaluationFormModal
        target={selfTarget}
        stage="self"
        templateId={template?.id ?? null}
        year={year}
        month={month}
        onClose={() => setSelfTarget(null)}
      />
    </>
  );
}
