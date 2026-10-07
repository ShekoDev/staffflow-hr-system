-- =====================================================================
-- Migration 0003 — Evaluation engine, weights, stages and monthly ranking
-- =====================================================================

-- ---------------------------------------------------------------------
-- evaluation_templates — a named set of criteria + stage weights
-- ---------------------------------------------------------------------
create table if not exists public.evaluation_templates (
  id            uuid primary key default gen_random_uuid(),
  name_en       text not null,
  name_ar       text,
  description   text,
  is_active     boolean not null default true,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- evaluation_criteria — fully dynamic, never hardcoded in the app
-- ---------------------------------------------------------------------
create table if not exists public.evaluation_criteria (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid references public.evaluation_templates(id) on delete cascade,
  key           text,
  name_en       text not null,
  name_ar       text not null,
  description   text,
  max_score     numeric(6,2) not null default 10 check (max_score > 0),
  weight        numeric(6,2) not null default 0 check (weight >= 0),
  stage         evaluation_stage_type not null default 'manager',
  sort_order    integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists evaluation_criteria_template_idx on public.evaluation_criteria(template_id);
create index if not exists evaluation_criteria_stage_idx    on public.evaluation_criteria(stage);

-- ---------------------------------------------------------------------
-- evaluation_stage_weights — how much each stage contributes to the final score
-- ---------------------------------------------------------------------
create table if not exists public.evaluation_stage_weights (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references public.evaluation_templates(id) on delete cascade,
  stage         evaluation_stage_type not null,
  weight        numeric(6,2) not null default 0 check (weight >= 0),
  is_enabled    boolean not null default true,
  unique (template_id, stage)
);

-- ---------------------------------------------------------------------
-- evaluations — one row per employee / period / stage / evaluator
-- ---------------------------------------------------------------------
create table if not exists public.evaluations (
  id             uuid primary key default gen_random_uuid(),
  employee_id    uuid not null references public.employees(id) on delete cascade,
  evaluator_id   uuid references public.users(id) on delete set null,
  template_id    uuid references public.evaluation_templates(id) on delete set null,
  stage          evaluation_stage_type not null default 'manager',
  period_year    integer not null,
  period_month   integer not null check (period_month between 1 and 12),
  total_score    numeric(6,2),
  percentage     numeric(6,2),
  status         evaluation_status not null default 'draft',
  comments       text,
  submitted_at   timestamptz,
  approved_by    uuid references public.users(id) on delete set null,
  approved_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (employee_id, stage, period_year, period_month, evaluator_id)
);
create index if not exists evaluations_employee_idx on public.evaluations(employee_id);
create index if not exists evaluations_period_idx   on public.evaluations(period_year, period_month);
create index if not exists evaluations_evaluator_idx on public.evaluations(evaluator_id);

-- ---------------------------------------------------------------------
-- evaluation_scores — one row per criterion inside an evaluation
-- ---------------------------------------------------------------------
create table if not exists public.evaluation_scores (
  id            uuid primary key default gen_random_uuid(),
  evaluation_id uuid not null references public.evaluations(id) on delete cascade,
  criterion_id  uuid not null references public.evaluation_criteria(id) on delete cascade,
  score         numeric(6,2) not null default 0 check (score >= 0),
  note          text,
  created_at    timestamptz not null default now(),
  unique (evaluation_id, criterion_id)
);
create index if not exists evaluation_scores_evaluation_idx on public.evaluation_scores(evaluation_id);

-- ---------------------------------------------------------------------
-- monthly_rankings — computed snapshot per employee per month
-- ---------------------------------------------------------------------
create table if not exists public.monthly_rankings (
  id                 uuid primary key default gen_random_uuid(),
  employee_id        uuid not null references public.employees(id) on delete cascade,
  period_year        integer not null,
  period_month       integer not null check (period_month between 1 and 12),
  attendance_score   numeric(6,2) not null default 0,
  punctuality_score  numeric(6,2) not null default 0,
  evaluation_score   numeric(6,2) not null default 0,
  final_score        numeric(6,2) not null default 0,
  rank               integer,
  is_employee_of_month boolean not null default false,
  computed_at        timestamptz not null default now(),
  unique (employee_id, period_year, period_month)
);
create index if not exists monthly_rankings_period_idx on public.monthly_rankings(period_year, period_month, rank);
