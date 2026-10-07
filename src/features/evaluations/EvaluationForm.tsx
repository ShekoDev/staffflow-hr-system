import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useI18n } from '@/i18n';
import { useToast } from '@/providers/ToastProvider';
import {
  fetchCriteria,
  fetchScores,
  saveEvaluation,
  scoreStage,
  type ScoreEntry,
} from '@/services/evaluations.service';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { ProgressBar } from '@/components/ui/Progress';
import { formatPercent } from '@/lib/format';
import type { Employee, EvaluationStage } from '@/types/models';

export interface EvaluationTarget {
  employee: Pick<Employee, 'id' | 'full_name_en' | 'full_name_ar' | 'photo_url' | 'job_title'>;
  evaluationId?: string;
  comments?: string | null;
}

/**
 * One scoring form, reused by the manager review and the self assessment.
 * Criteria come from the database, so the form's shape follows whatever
 * the administrator has configured for this stage.
 */
export function EvaluationFormModal({
  target,
  stage,
  templateId,
  year,
  month,
  onClose,
}: {
  target: EvaluationTarget | null;
  stage: EvaluationStage;
  templateId: string | null;
  year: number;
  month: number;
  onClose: () => void;
}) {
  const { t, localized, language } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { data: criteriaData, isLoading } = useQuery({
    queryKey: ['evaluation-criteria', templateId],
    queryFn: () => fetchCriteria(templateId ?? undefined),
    enabled: Boolean(target),
  });

  // Both lists are memoised instead of defaulted inline — an inline `?? []`
  // creates a new array on every render, which would restart the effects below.
  const criteria = useMemo(
    () => (criteriaData ?? []).filter((c) => c.stage === stage && c.is_active),
    [criteriaData, stage],
  );

  const { data: scoresData } = useQuery({
    queryKey: ['evaluation-scores', target?.evaluationId],
    queryFn: () => fetchScores(target?.evaluationId as string),
    enabled: Boolean(target?.evaluationId),
  });

  const existingScores = useMemo(() => scoresData ?? [], [scoresData]);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [comments, setComments] = useState('');

  useEffect(() => {
    if (!target) return;
    setComments(target.comments ?? '');
  }, [target]);

  useEffect(() => {
    const next: Record<string, number> = {};
    for (const criterion of criteria) {
      const found = existingScores.find((s) => s.criterion_id === criterion.id);
      next[criterion.id] = found ? Number(found.score) : 0;
    }
    setScores(next);
  }, [criteria, existingScores]);

  const percentage = useMemo(
    () => scoreStage(criteria, new Map(Object.entries(scores))),
    [criteria, scores],
  );

  const mutation = useMutation({
    mutationFn: (status: 'draft' | 'submitted') => {
      const entries: ScoreEntry[] = criteria.map((criterion) => ({
        criterion_id: criterion.id,
        score: scores[criterion.id] ?? 0,
      }));
      return saveEvaluation({
        id: target?.evaluationId,
        employee_id: target?.employee.id as string,
        template_id: templateId,
        stage,
        period_year: year,
        period_month: month,
        comments: comments || null,
        status,
        scores: entries,
        criteria,
      });
    },
    onSuccess: () => {
      toast.success(t('evaluations.submitted'));
      void queryClient.invalidateQueries({ queryKey: ['evaluations'] });
      void queryClient.invalidateQueries({ queryKey: ['evaluation-scores'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
  });

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      size="lg"
      title={
        target ? localized(target.employee.full_name_en, target.employee.full_name_ar) : ''
      }
      description={target?.employee.job_title ?? undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="secondary"
            loading={mutation.isPending}
            onClick={() => mutation.mutate('draft')}
          >
            {t('evaluations.saveDraft')}
          </Button>
          <Button loading={mutation.isPending} onClick={() => mutation.mutate('submitted')}>
            {t('evaluations.submit')}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : criteria.length === 0 ? (
        <EmptyState
          title={t('evaluations.noCriteria')}
          description={t('evaluations.noCriteriaBody')}
        />
      ) : (
        <>
          <div
            className="mb-5 flex items-center justify-between gap-4 rounded-theme-sm p-4"
            style={{ background: 'color-mix(in srgb, var(--sf-primary) 8%, transparent)' }}
          >
            <span className="text-sm font-semibold text-content">
              {t('evaluations.weightedScore')}
            </span>
            <span className="text-2xl font-extrabold text-primary">
              {formatPercent(percentage, language)}
            </span>
          </div>

          <div className="space-y-4">
            {criteria.map((criterion) => {
              const value = scores[criterion.id] ?? 0;
              return (
                <div key={criterion.id} className="rounded-theme-sm border border-line p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-content">
                      {localized(criterion.name_en, criterion.name_ar)}
                    </span>
                    <span className="text-xs font-bold text-content-muted">
                      {t('evaluations.weight')}: {criterion.weight}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={criterion.max_score}
                      step={0.5}
                      value={value}
                      onChange={(e) =>
                        setScores((current) => ({
                          ...current,
                          [criterion.id]: Number(e.target.value),
                        }))
                      }
                      className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-content-muted/20 accent-[var(--sf-primary)]"
                    />
                    <input
                      type="number"
                      min={0}
                      max={criterion.max_score}
                      step={0.5}
                      value={value}
                      onChange={(e) =>
                        setScores((current) => ({
                          ...current,
                          [criterion.id]: Math.min(
                            Number(e.target.value) || 0,
                            Number(criterion.max_score),
                          ),
                        }))
                      }
                      className="sf-input h-9 w-20 py-0 text-center text-sm"
                    />
                    <span className="w-10 shrink-0 text-xs text-content-muted">
                      / {criterion.max_score}
                    </span>
                  </div>
                  <ProgressBar
                    value={(value / Number(criterion.max_score)) * 100}
                    className="mt-2"
                  />
                </div>
              );
            })}
          </div>

          <Textarea
            label={t('evaluations.comments')}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            wrapperClassName="mt-5"
            rows={3}
          />
        </>
      )}
    </Modal>
  );
}
