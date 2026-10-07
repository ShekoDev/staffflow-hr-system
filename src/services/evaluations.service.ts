import { supabase, describeError } from '@/lib/supabase';
import type {
  Evaluation,
  EvaluationCriterion,
  EvaluationStage,
  EvaluationStageWeight,
  EvaluationStatus,
  EvaluationTemplate,
} from '@/types/models';
import { logAudit } from './audit.service';

export const EVALUATION_STAGES: EvaluationStage[] = ['manager', 'administrative', 'self', 'peer'];

/* ------------------------------------------------------------------ */
/* Templates and criteria                                              */
/* ------------------------------------------------------------------ */

export async function fetchDefaultTemplate(): Promise<EvaluationTemplate | null> {
  const { data } = await supabase
    .from('evaluation_templates')
    .select('*')
    .eq('is_default', true)
    .maybeSingle();
  return (data as EvaluationTemplate) ?? null;
}

export async function fetchCriteria(templateId?: string): Promise<EvaluationCriterion[]> {
  let request = supabase.from('evaluation_criteria').select('*').order('stage').order('sort_order');
  if (templateId) request = request.eq('template_id', templateId);
  const { data, error } = await request;
  if (error) throw new Error(describeError(error));
  return (data ?? []) as EvaluationCriterion[];
}

export type CriterionInput = {
  template_id: string | null;
  key: string | null;
  name_en: string;
  name_ar: string;
  description: string | null;
  max_score: number;
  weight: number;
  stage: EvaluationStage;
  sort_order: number;
  is_active: boolean;
};

export async function saveCriterion(
  input: CriterionInput,
  id?: string,
): Promise<EvaluationCriterion> {
  const query = id
    ? supabase.from('evaluation_criteria').update(input).eq('id', id)
    : supabase.from('evaluation_criteria').insert(input);
  const { data, error } = await query.select().single();
  if (error) throw new Error(describeError(error));
  await logAudit(id ? 'update' : 'create', 'evaluation_criteria', (data as { id: string }).id, input.name_en);
  return data as EvaluationCriterion;
}

export async function deleteCriterion(id: string, label?: string): Promise<void> {
  const { error } = await supabase.from('evaluation_criteria').delete().eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('delete', 'evaluation_criteria', id, label ?? null);
}

/* ------------------------------------------------------------------ */
/* Stage weights                                                       */
/* ------------------------------------------------------------------ */

export async function fetchStageWeights(templateId: string): Promise<EvaluationStageWeight[]> {
  const { data, error } = await supabase
    .from('evaluation_stage_weights')
    .select('*')
    .eq('template_id', templateId);
  if (error) throw new Error(describeError(error));
  return (data ?? []) as EvaluationStageWeight[];
}

export async function saveStageWeights(
  templateId: string,
  weights: { stage: EvaluationStage; weight: number; is_enabled: boolean }[],
): Promise<void> {
  const { error } = await supabase.from('evaluation_stage_weights').upsert(
    weights.map((w) => ({ template_id: templateId, ...w })),
    { onConflict: 'template_id,stage' },
  );
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'evaluation_stage_weights', templateId, null, { weights });
}

/* ------------------------------------------------------------------ */
/* Evaluations                                                         */
/* ------------------------------------------------------------------ */

const EVALUATION_SELECT = `
  *,
  employee:employees(
    id, employee_code, full_name_en, full_name_ar, photo_url, job_title,
    frame_id, name_color, department:departments(id,name_en,name_ar)
  )
`;

export interface EvaluationQuery {
  employeeId?: string;
  stage?: EvaluationStage;
  year: number;
  month: number;
}

export async function fetchEvaluations(query: EvaluationQuery): Promise<Evaluation[]> {
  let request = supabase
    .from('evaluations')
    .select(EVALUATION_SELECT)
    .eq('period_year', query.year)
    .eq('period_month', query.month);

  if (query.employeeId) request = request.eq('employee_id', query.employeeId);
  if (query.stage) request = request.eq('stage', query.stage);

  const { data, error } = await request;
  if (error) throw new Error(describeError(error));
  return (data ?? []) as unknown as Evaluation[];
}

export interface ScoreEntry {
  criterion_id: string;
  score: number;
  note?: string | null;
}

export async function fetchScores(evaluationId: string): Promise<ScoreEntry[]> {
  const { data } = await supabase
    .from('evaluation_scores')
    .select('criterion_id, score, note')
    .eq('evaluation_id', evaluationId);
  return (data ?? []) as ScoreEntry[];
}

/**
 * Weighted percentage for one stage.
 *
 * Each criterion contributes `score / max_score * weight`; the total is
 * divided by the weights actually in play, so removing a criterion never
 * silently inflates or deflates everyone's score.
 */
export function scoreStage(criteria: EvaluationCriterion[], scores: Map<string, number>): number {
  let earned = 0;
  let possible = 0;
  for (const criterion of criteria) {
    if (!criterion.is_active) continue;
    const weight = Number(criterion.weight) || 0;
    if (weight <= 0) continue;
    const raw = scores.get(criterion.id) ?? 0;
    earned += (Math.min(raw, criterion.max_score) / criterion.max_score) * weight;
    possible += weight;
  }
  return possible > 0 ? Math.round((earned / possible) * 1000) / 10 : 0;
}

export interface SaveEvaluationInput {
  id?: string;
  employee_id: string;
  template_id: string | null;
  stage: EvaluationStage;
  period_year: number;
  period_month: number;
  comments: string | null;
  status: EvaluationStatus;
  scores: ScoreEntry[];
  criteria: EvaluationCriterion[];
}

/** Saves the header row and replaces its score lines in one operation. */
export async function saveEvaluation(input: SaveEvaluationInput): Promise<string> {
  const { data: session } = await supabase.auth.getUser();
  const evaluatorId = session.user?.id ?? null;

  const scoreMap = new Map(input.scores.map((s) => [s.criterion_id, s.score]));
  const percentage = scoreStage(input.criteria, scoreMap);
  const totalScore = input.scores.reduce((sum, s) => sum + s.score, 0);

  const header = {
    employee_id: input.employee_id,
    evaluator_id: evaluatorId,
    template_id: input.template_id,
    stage: input.stage,
    period_year: input.period_year,
    period_month: input.period_month,
    total_score: totalScore,
    percentage,
    status: input.status,
    comments: input.comments,
    submitted_at: input.status === 'draft' ? null : new Date().toISOString(),
  };

  const { data, error } = input.id
    ? await supabase.from('evaluations').update(header).eq('id', input.id).select('id').single()
    : await supabase
        .from('evaluations')
        .upsert(header, { onConflict: 'employee_id,stage,period_year,period_month,evaluator_id' })
        .select('id')
        .single();

  if (error) throw new Error(describeError(error));
  const evaluationId = (data as { id: string }).id;

  await supabase.from('evaluation_scores').delete().eq('evaluation_id', evaluationId);
  if (input.scores.length > 0) {
    const { error: scoreError } = await supabase.from('evaluation_scores').insert(
      input.scores.map((s) => ({
        evaluation_id: evaluationId,
        criterion_id: s.criterion_id,
        score: s.score,
        note: s.note ?? null,
      })),
    );
    if (scoreError) throw new Error(describeError(scoreError));
  }

  await logAudit(
    input.id ? 'update' : 'create',
    'evaluations',
    evaluationId,
    `${input.stage} ${input.period_year}-${input.period_month}`,
    { percentage, status: input.status },
  );

  return evaluationId;
}

export async function approveEvaluation(id: string): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('evaluations')
    .update({
      status: 'approved',
      approved_by: session.user?.id ?? null,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(describeError(error));
  await logAudit('update', 'evaluations', id, 'approved');
}

/**
 * Blends the stages into one number using the admin-controlled weights.
 * Stages that are disabled, or that have no evaluation for the period, are
 * dropped and the remaining weights renormalised.
 */
export function combineStages(
  evaluations: Evaluation[],
  weights: EvaluationStageWeight[],
): { final: number; breakdown: { stage: EvaluationStage; percentage: number; weight: number }[] } {
  const breakdown: { stage: EvaluationStage; percentage: number; weight: number }[] = [];
  let earned = 0;
  let possible = 0;

  for (const weight of weights) {
    if (!weight.is_enabled || Number(weight.weight) <= 0) continue;
    const stageRows = evaluations.filter((e) => e.stage === weight.stage);
    if (stageRows.length === 0) continue;

    const average =
      stageRows.reduce((sum, row) => sum + (row.percentage ?? 0), 0) / stageRows.length;

    breakdown.push({
      stage: weight.stage,
      percentage: Math.round(average * 10) / 10,
      weight: Number(weight.weight),
    });
    earned += average * Number(weight.weight);
    possible += Number(weight.weight);
  }

  return {
    final: possible > 0 ? Math.round((earned / possible) * 10) / 10 : 0,
    breakdown,
  };
}
