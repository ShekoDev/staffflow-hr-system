-- =====================================================================
-- Migration 0002 — Attendance, absence and leave management
-- =====================================================================

create table if not exists public.attendance (
  id                   uuid primary key default gen_random_uuid(),
  employee_id          uuid not null references public.employees(id) on delete cascade,
  work_date            date not null,
  status               attendance_status not null default 'present',
  check_in             time,
  check_out            time,
  late_minutes         integer not null default 0 check (late_minutes >= 0),
  early_leave_minutes  integer not null default 0 check (early_leave_minutes >= 0),
  worked_minutes       integer,
  is_excused           boolean not null default false,
  notes                text,
  created_by           uuid references public.users(id) on delete set null,
  updated_by           uuid references public.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (employee_id, work_date)
);
create index if not exists attendance_employee_idx on public.attendance(employee_id);
create index if not exists attendance_date_idx     on public.attendance(work_date);
create index if not exists attendance_status_idx   on public.attendance(status);
create index if not exists attendance_emp_date_idx on public.attendance(employee_id, work_date desc);

-- ---------------------------------------------------------------------
-- leave_types
-- ---------------------------------------------------------------------
create table if not exists public.leave_types (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,
  name_en       text not null,
  name_ar       text not null,
  is_paid       boolean not null default true,
  max_days_year integer,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------
create table if not exists public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  employee_id   uuid not null references public.employees(id) on delete cascade,
  leave_type_id uuid references public.leave_types(id) on delete set null,
  start_date    date not null,
  end_date      date not null,
  days_count    integer generated always as ((end_date - start_date) + 1) stored,
  reason        text,
  status        leave_status not null default 'pending',
  reviewed_by   uuid references public.users(id) on delete set null,
  reviewed_at   timestamptz,
  review_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists leave_requests_employee_idx on public.leave_requests(employee_id);
create index if not exists leave_requests_status_idx   on public.leave_requests(status);
create index if not exists leave_requests_dates_idx    on public.leave_requests(start_date, end_date);

-- ---------------------------------------------------------------------
-- holidays (company calendar)
-- ---------------------------------------------------------------------
create table if not exists public.holidays (
  id            uuid primary key default gen_random_uuid(),
  holiday_date  date not null unique,
  name_en       text not null,
  name_ar       text,
  is_recurring  boolean not null default false,
  created_at    timestamptz not null default now()
);
