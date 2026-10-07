-- =====================================================================
-- Migration 0005 — Helper functions, triggers and audit plumbing
--
-- All authorization helpers are SECURITY DEFINER so that RLS policies can
-- call them without recursing back into the policies of the same table.
-- =====================================================================

-- ---------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'roles','users','departments','employees','teams','attendance',
    'leave_requests','evaluation_templates','evaluation_criteria','evaluations'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Identity helpers
-- ---------------------------------------------------------------------
create or replace function public.current_user_active()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_active from public.users where id = auth.uid()), false);
$$;

create or replace function public.current_role_key()
returns text
language sql stable security definer set search_path = public
as $$
  select r.key
  from public.users u
  join public.roles r on r.id = u.role_id
  where u.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.current_role_key() = 'admin' and public.current_user_active();
$$;

create or replace function public.current_employee_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.employees where user_id = auth.uid() limit 1;
$$;

-- ---------------------------------------------------------------------
-- Permission resolution: role grants, overridden per user.
-- An explicit user deny always wins; an explicit user grant adds.
-- ---------------------------------------------------------------------
create or replace function public.has_permission(perm_key text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_perm_id uuid;
  v_override boolean;
  v_from_role boolean;
begin
  if v_user_id is null then
    return false;
  end if;

  if not public.current_user_active() then
    return false;
  end if;

  -- admins bypass the permission matrix entirely
  if public.current_role_key() = 'admin' then
    return true;
  end if;

  select id into v_perm_id from public.permissions where key = perm_key;
  if v_perm_id is null then
    return false;
  end if;

  select granted into v_override
  from public.user_permissions
  where user_id = v_user_id and permission_id = v_perm_id;

  if v_override is not null then
    return v_override;
  end if;

  select exists (
    select 1
    from public.users u
    join public.role_permissions rp on rp.role_id = u.role_id
    where u.id = v_user_id and rp.permission_id = v_perm_id
  ) into v_from_role;

  return coalesce(v_from_role, false);
end;
$$;

-- ---------------------------------------------------------------------
-- Management scope: direct/indirect line manager, department manager,
-- or manager of a team the target belongs to.
-- ---------------------------------------------------------------------
create or replace function public.is_manager_of(target_employee_id uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  me uuid := public.current_employee_id();
begin
  if me is null or target_employee_id is null then
    return false;
  end if;
  if me = target_employee_id then
    return false;
  end if;

  -- 1) line-manager chain (supports multi-level hierarchies)
  if exists (
    with recursive chain as (
      select id, manager_id from public.employees where id = target_employee_id
      union all
      select e.id, e.manager_id
      from public.employees e
      join chain c on e.id = c.manager_id
    )
    select 1 from chain where manager_id = me
  ) then
    return true;
  end if;

  -- 2) department manager
  if exists (
    select 1
    from public.employees e
    join public.departments d on d.id = e.department_id
    where e.id = target_employee_id and d.manager_id = me
  ) then
    return true;
  end if;

  -- 3) team manager
  if exists (
    select 1
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.employee_id = target_employee_id and t.manager_id = me
  ) then
    return true;
  end if;

  return false;
end;
$$;

-- ---------------------------------------------------------------------
-- Row visibility for a single employee record
-- ---------------------------------------------------------------------
create or replace function public.can_view_employee(target_employee_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.current_user_active() and (
    public.is_admin()
    -- their own record
    or target_employee_id = public.current_employee_id()
    -- their own line manager, so "My Manager" resolves on the dashboard
    or target_employee_id = (
         select manager_id from public.employees where id = public.current_employee_id()
       )
    or public.has_permission('employees.view_all')
    or (public.has_permission('employees.view_team')
        and public.is_manager_of(target_employee_id))
  );
$$;

create or replace function public.can_manage_employee(target_employee_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    public.is_admin()
    or public.has_permission('employees.edit_all')
    or (public.has_permission('employees.edit_team')
        and public.is_manager_of(target_employee_id));
$$;

-- ---------------------------------------------------------------------
-- New auth user -> public.users row
--
-- Sign-up metadata is attacker-controlled (the anon key is public), so the
-- requested role is deliberately IGNORED here: every new account starts as
-- an inactive employee. An administrator activates it and assigns the real
-- role afterwards, which requires the users.manage permission. The very
-- first administrator is promoted once via bootstrap_first_admin().
-- ---------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_role_id uuid;
begin
  select id into v_role_id from public.roles where key = 'employee';

  insert into public.users (id, email, username, role_id, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'username', split_part(new.email, '@', 1)),
    v_role_id,
    false
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------
-- Audit logging helper (called from the app through RPC)
-- ---------------------------------------------------------------------
create or replace function public.log_audit(
  p_action text,
  p_entity_type text,
  p_entity_id uuid default null,
  p_target_label text default null,
  p_changes jsonb default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_name text;
begin
  select coalesce(e.full_name_en, u.username, u.email)
    into v_name
  from public.users u
  left join public.employees e on e.user_id = u.id
  where u.id = auth.uid();

  insert into public.audit_logs (user_id, actor_name, action, entity_type, entity_id, target_label, changes)
  values (auth.uid(), v_name, p_action, p_entity_type, p_entity_id, p_target_label, p_changes);
end;
$$;

-- ---------------------------------------------------------------------
-- Effective permission list for the signed-in user (used by the frontend)
-- ---------------------------------------------------------------------
create or replace function public.my_permissions()
returns table (key text)
language sql stable security definer set search_path = public
as $$
  with role_perms as (
    select p.id, p.key
    from public.users u
    join public.role_permissions rp on rp.role_id = u.role_id
    join public.permissions p on p.id = rp.permission_id
    where u.id = auth.uid()
  ),
  overrides as (
    select up.permission_id, up.granted, p.key
    from public.user_permissions up
    join public.permissions p on p.id = up.permission_id
    where up.user_id = auth.uid()
  ),
  all_admin as (
    select p.id, p.key from public.permissions p
    where public.current_role_key() = 'admin'
  )
  select distinct k from (
    select key as k from all_admin
    union
    select key as k from role_perms
      where id not in (select permission_id from overrides where granted = false)
    union
    select key as k from overrides where granted = true
  ) s
  where public.current_user_active();
$$;

-- ---------------------------------------------------------------------
-- Privilege guard.
--
-- users_update_self lets a signed-in user edit their own row (language,
-- theme, colour mode). Without this trigger that same policy would also
-- let them rewrite their own role_id and hand themselves admin. Only a
-- holder of users.manage — or a server-side call with no JWT, such as the
-- SQL editor — may touch the privilege columns.
-- ---------------------------------------------------------------------
create or replace function public.protect_user_privileges()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;                       -- server-side / service role
  end if;

  if (new.role_id              is distinct from old.role_id
   or new.is_active            is distinct from old.is_active
   or new.must_change_password is distinct from old.must_change_password
   or new.id                   is distinct from old.id)
     and not public.has_permission('users.manage')
  then
    raise exception 'Changing role or account status requires the users.manage permission'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_user_privileges on public.users;
create trigger protect_user_privileges
  before update on public.users
  for each row execute function public.protect_user_privileges();

-- ---------------------------------------------------------------------
-- Monthly ranking computation
-- ---------------------------------------------------------------------
create or replace function public.compute_monthly_ranking(p_year integer, p_month integer)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_period_start date := make_date(p_year, p_month, 1);
  v_period_end   date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
  v_w_attendance numeric := coalesce((select (value ->> 'attendance')::numeric from public.system_settings where key = 'ranking_weights'), 25);
  v_w_punctual   numeric := coalesce((select (value ->> 'punctuality')::numeric from public.system_settings where key = 'ranking_weights'), 15);
  v_w_evaluation numeric := coalesce((select (value ->> 'evaluation')::numeric from public.system_settings where key = 'ranking_weights'), 60);
  v_count integer;
begin
  if not (public.is_admin() or public.has_permission('ranking.manage')) then
    raise exception 'insufficient_privilege';
  end if;

  delete from public.monthly_rankings where period_year = p_year and period_month = p_month;

  with base as (
    select
      e.id as employee_id,
      count(a.*) filter (where a.status in ('present','late','early_leave')) as present_days,
      count(a.*) filter (where a.status is not null and a.status <> 'holiday')  as total_days,
      count(a.*) filter (where a.status = 'late') as late_days,
      coalesce(avg(ev.percentage), 0) as eval_pct
    from public.employees e
    left join public.attendance a
      on a.employee_id = e.id and a.work_date between v_period_start and v_period_end
    left join public.evaluations ev
      on ev.employee_id = e.id
     and ev.period_year = p_year and ev.period_month = p_month
     and ev.status = 'approved'
    where e.employment_status = 'active'
    group by e.id
  ),
  scored as (
    select
      employee_id,
      case when total_days = 0 then 0 else round((present_days::numeric / total_days) * 100, 2) end as attendance_score,
      case when present_days = 0 then 100 else round(((present_days - late_days)::numeric / present_days) * 100, 2) end as punctuality_score,
      round(eval_pct, 2) as evaluation_score
    from base
  ),
  finalized as (
    select
      employee_id, attendance_score, punctuality_score, evaluation_score,
      round((attendance_score * v_w_attendance + punctuality_score * v_w_punctual + evaluation_score * v_w_evaluation)
            / nullif(v_w_attendance + v_w_punctual + v_w_evaluation, 0), 2) as final_score
    from scored
  )
  insert into public.monthly_rankings
    (employee_id, period_year, period_month, attendance_score, punctuality_score,
     evaluation_score, final_score, rank, is_employee_of_month)
  select
    employee_id, p_year, p_month, attendance_score, punctuality_score,
    evaluation_score, final_score,
    rank() over (order by final_score desc),
    rank() over (order by final_score desc) = 1
  from finalized;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
