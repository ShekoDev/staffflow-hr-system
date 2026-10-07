-- =====================================================================
-- Migration 0004 — Customization: frames, badges, themes, name colors,
--                  notifications, audit logs, system settings
-- =====================================================================

-- ---------------------------------------------------------------------
-- profile_frames
-- ---------------------------------------------------------------------
create table if not exists public.profile_frames (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  name_en        text not null,
  name_ar        text not null,
  -- CSS description consumed by the frontend (gradient ring, glow, width...)
  css_gradient   text,                       -- e.g. linear-gradient(...)
  ring_width     integer not null default 3,
  glow_color     text,
  icon           text,
  auto_role_key  text,                       -- auto-assign to this role
  auto_condition text,                       -- 'employee_of_month' | 'top_performer' | null
  priority       integer not null default 100, -- lower wins
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table public.employees
  drop constraint if exists employees_frame_fk;
alter table public.employees
  add constraint employees_frame_fk
  foreign key (frame_id) references public.profile_frames(id) on delete set null;

-- ---------------------------------------------------------------------
-- badges
-- ---------------------------------------------------------------------
create table if not exists public.badges (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  name_en        text not null,
  name_ar        text not null,
  icon           text,                        -- emoji or icon name
  color          text,
  description    text,
  auto_role_key  text,
  auto_condition text,                        -- employee_of_month | top_performer | perfect_attendance | new_employee
  priority       integer not null default 100,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists public.employee_badges (
  id           uuid primary key default gen_random_uuid(),
  employee_id  uuid not null references public.employees(id) on delete cascade,
  badge_id     uuid not null references public.badges(id) on delete cascade,
  awarded_at   timestamptz not null default now(),
  expires_at   timestamptz,
  awarded_by   uuid references public.users(id) on delete set null,
  note         text,
  unique (employee_id, badge_id)
);
create index if not exists employee_badges_employee_idx on public.employee_badges(employee_id);

-- ---------------------------------------------------------------------
-- name_color_rules — priority-driven automatic name colouring
-- ---------------------------------------------------------------------
create table if not exists public.name_color_rules (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique,
  name_en        text not null,
  name_ar        text not null,
  color          text not null,               -- hex or css color
  condition_type text not null,               -- role | status
  condition_value text not null,              -- admin|hr|manager|employee | employee_of_month|top_performer
  priority       integer not null default 100,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- themes
-- ---------------------------------------------------------------------
create table if not exists public.themes (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name_en     text not null,
  name_ar     text not null,
  -- token maps consumed by the theme provider
  tokens_light jsonb not null default '{}'::jsonb,
  tokens_dark  jsonb not null default '{}'::jsonb,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title_en    text not null,
  title_ar    text,
  body_en     text,
  body_ar     text,
  type        text not null default 'info',   -- info | success | warning | evaluation | attendance | ranking
  link        text,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, is_read, created_at desc);

-- ---------------------------------------------------------------------
-- audit_logs
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.users(id) on delete set null,
  actor_name   text,
  action       text not null,                 -- create | update | delete | export | login | permission_change
  entity_type  text not null,                 -- employees | attendance | evaluations | settings ...
  entity_id    uuid,
  target_label text,
  changes      jsonb,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);
create index if not exists audit_logs_user_idx    on public.audit_logs(user_id);
create index if not exists audit_logs_entity_idx  on public.audit_logs(entity_type, entity_id);

-- ---------------------------------------------------------------------
-- system_settings — single-row-per-key configuration store
-- ---------------------------------------------------------------------
create table if not exists public.system_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  category    text not null default 'general',
  is_public   boolean not null default true,  -- readable by any authenticated user
  updated_by  uuid references public.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);
