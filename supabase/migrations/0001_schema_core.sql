-- =====================================================================
-- StaffFlow — Employee Management & HR System
-- Migration 0001 — Core schema: roles, permissions, users, org structure
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
  create type gender_type as enum ('male', 'female');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

do $$ begin
  create type attendance_status as enum (
    'present', 'absent', 'late', 'leave', 'holiday', 'excused', 'early_leave'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type evaluation_stage_type as enum (
    'manager', 'administrative', 'self', 'peer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type evaluation_status as enum ('draft', 'submitted', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- roles
-- ---------------------------------------------------------------------
create table if not exists public.roles (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,          -- admin | hr | manager | employee | custom
  name_en       text not null,
  name_ar       text not null,
  description   text,
  is_system     boolean not null default false, -- system roles cannot be deleted
  rank          integer not null default 100,   -- lower = more privileged
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- permissions  (granular, module-scoped)
-- ---------------------------------------------------------------------
create table if not exists public.permissions (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,          -- e.g. employees.create
  module        text not null,                 -- employees | attendance | evaluations | ...
  name_en       text not null,
  name_ar       text not null,
  description   text,
  created_at    timestamptz not null default now()
);
create index if not exists permissions_module_idx on public.permissions(module);

-- ---------------------------------------------------------------------
-- role_permissions
-- ---------------------------------------------------------------------
create table if not exists public.role_permissions (
  role_id       uuid not null references public.roles(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (role_id, permission_id)
);

-- ---------------------------------------------------------------------
-- users  (extends auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id                   uuid primary key references auth.users(id) on delete cascade,
  username             text unique,
  email                text not null,
  role_id              uuid references public.roles(id) on delete restrict,
  is_active            boolean not null default true,
  must_change_password boolean not null default false,
  preferred_language   text not null default 'en' check (preferred_language in ('en','ar')),
  preferred_theme      text,
  color_mode           text not null default 'system' check (color_mode in ('light','dark','system')),
  last_login_at        timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists users_role_idx on public.users(role_id);

-- ---------------------------------------------------------------------
-- user_permissions  (per-user overrides on top of the role)
--   granted = true  -> explicitly allow
--   granted = false -> explicitly deny (wins over role grant)
-- ---------------------------------------------------------------------
create table if not exists public.user_permissions (
  user_id       uuid not null references public.users(id) on delete cascade,
  permission_id uuid not null references public.permissions(id) on delete cascade,
  granted       boolean not null default true,
  created_at    timestamptz not null default now(),
  primary key (user_id, permission_id)
);

-- ---------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------
create table if not exists public.departments (
  id            uuid primary key default gen_random_uuid(),
  code          text unique,
  name_en       text not null,
  name_ar       text not null,
  description   text,
  manager_id    uuid,                       -- FK added after employees exists
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------
create table if not exists public.employees (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid unique references public.users(id) on delete set null,
  employee_code     text not null unique,
  full_name_en      text not null,
  full_name_ar      text,
  photo_url         text,
  email             text,
  phone             text,
  job_title         text,
  department_id     uuid references public.departments(id) on delete set null,
  manager_id        uuid references public.employees(id) on delete set null,
  gender            gender_type,
  joining_date      date,
  employment_status employment_status not null default 'active',
  frame_id          uuid,                    -- FK added in 0004
  name_color        text,                    -- explicit override; null = derived from rules
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists employees_department_idx on public.employees(department_id);
create index if not exists employees_manager_idx    on public.employees(manager_id);
create index if not exists employees_user_idx       on public.employees(user_id);
create index if not exists employees_status_idx     on public.employees(employment_status);

alter table public.departments
  drop constraint if exists departments_manager_fk;
alter table public.departments
  add constraint departments_manager_fk
  foreign key (manager_id) references public.employees(id) on delete set null;

-- ---------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------
create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  name_en       text not null,
  name_ar       text,
  department_id uuid references public.departments(id) on delete cascade,
  manager_id    uuid references public.employees(id) on delete set null,
  description   text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists teams_department_idx on public.teams(department_id);
create index if not exists teams_manager_idx    on public.teams(manager_id);

create table if not exists public.team_members (
  team_id       uuid not null references public.teams(id) on delete cascade,
  employee_id   uuid not null references public.employees(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (team_id, employee_id)
);
create index if not exists team_members_employee_idx on public.team_members(employee_id);
