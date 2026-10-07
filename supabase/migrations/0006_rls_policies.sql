-- =====================================================================
-- Migration 0006 — Row Level Security
--
-- Every table is protected. The client only ever talks to PostgREST with
-- the user's JWT, so an employee cannot read another employee's row even
-- by crafting the request by hand.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'roles','permissions','role_permissions','users','user_permissions',
    'departments','employees','teams','team_members',
    'attendance','leave_types','leave_requests','holidays',
    'evaluation_templates','evaluation_criteria','evaluation_stage_weights',
    'evaluations','evaluation_scores','monthly_rankings',
    'profile_frames','badges','employee_badges','name_color_rules','themes',
    'notifications','audit_logs','system_settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Helper: drop a policy if it exists, then create it.
-- (Written out explicitly below for clarity.)

-- ---------------------------------------------------------------------
-- Reference / lookup tables: readable by any active signed-in user,
-- writable only with the matching permission.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  read_tables text[] := array[
    'roles','permissions','role_permissions','departments','teams','team_members',
    'leave_types','holidays','evaluation_templates','evaluation_criteria',
    'evaluation_stage_weights','profile_frames','badges','employee_badges',
    'name_color_rules','themes'
  ];
begin
  foreach t in array read_tables loop
    execute format('drop policy if exists "%s_read" on public.%I', t, t);
    execute format(
      'create policy "%s_read" on public.%I for select to authenticated
       using (public.current_user_active())', t, t);
  end loop;
end $$;

-- Write access on org structure
drop policy if exists departments_write on public.departments;
create policy departments_write on public.departments for all to authenticated
  using (public.has_permission('departments.manage'))
  with check (public.has_permission('departments.manage'));

drop policy if exists teams_write on public.teams;
create policy teams_write on public.teams for all to authenticated
  using (public.has_permission('teams.manage'))
  with check (public.has_permission('teams.manage'));

drop policy if exists team_members_write on public.team_members;
create policy team_members_write on public.team_members for all to authenticated
  using (public.has_permission('teams.manage'))
  with check (public.has_permission('teams.manage'));

-- Write access on roles & permission matrix (admin only)
drop policy if exists roles_write on public.roles;
create policy roles_write on public.roles for all to authenticated
  using (public.has_permission('roles.manage'))
  with check (public.has_permission('roles.manage'));

drop policy if exists permissions_write on public.permissions;
create policy permissions_write on public.permissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (public.has_permission('permissions.manage'))
  with check (public.has_permission('permissions.manage'));

-- Customization write access
do $$
declare t text;
begin
  foreach t in array array['profile_frames','badges','name_color_rules','themes','leave_types','holidays'] loop
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format(
      'create policy "%s_write" on public.%I for all to authenticated
       using (public.has_permission(''customization.manage''))
       with check (public.has_permission(''customization.manage''))', t, t);
  end loop;
end $$;

drop policy if exists employee_badges_write on public.employee_badges;
create policy employee_badges_write on public.employee_badges for all to authenticated
  using (public.has_permission('customization.manage'))
  with check (public.has_permission('customization.manage'));

-- Evaluation configuration write access
do $$
declare t text;
begin
  foreach t in array array['evaluation_templates','evaluation_criteria','evaluation_stage_weights'] loop
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format(
      'create policy "%s_write" on public.%I for all to authenticated
       using (public.has_permission(''evaluations.configure''))
       with check (public.has_permission(''evaluations.configure''))', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (
    id = auth.uid()
    or public.has_permission('users.view')
  );

-- NOTE: users_update_self intentionally allows a user to edit their own row
-- (language, theme, colour mode). The protect_user_privileges trigger in
-- migration 0005 is what stops that same policy from being used to change
-- role_id or is_active.

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists users_manage on public.users;
create policy users_manage on public.users for all to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

drop policy if exists user_permissions_select on public.user_permissions;
create policy user_permissions_select on public.user_permissions for select to authenticated
  using (user_id = auth.uid() or public.has_permission('permissions.manage'));

drop policy if exists user_permissions_write on public.user_permissions;
create policy user_permissions_write on public.user_permissions for all to authenticated
  using (public.has_permission('permissions.manage'))
  with check (public.has_permission('permissions.manage'));

-- ---------------------------------------------------------------------
-- employees
-- ---------------------------------------------------------------------
drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees for select to authenticated
  using (public.can_view_employee(id));

drop policy if exists employees_insert on public.employees;
create policy employees_insert on public.employees for insert to authenticated
  with check (public.has_permission('employees.create'));

drop policy if exists employees_update on public.employees;
create policy employees_update on public.employees for update to authenticated
  using (public.can_manage_employee(id))
  with check (public.can_manage_employee(id));

drop policy if exists employees_delete on public.employees;
create policy employees_delete on public.employees for delete to authenticated
  using (public.has_permission('employees.delete'));

-- ---------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------
drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance for select to authenticated
  using (
    public.has_permission('attendance.view_all')
    or employee_id = public.current_employee_id()
    or (public.has_permission('attendance.view_team') and public.is_manager_of(employee_id))
  );

drop policy if exists attendance_write on public.attendance;
create policy attendance_write on public.attendance for all to authenticated
  using (
    public.has_permission('attendance.manage')
    or (public.has_permission('attendance.manage_team') and public.is_manager_of(employee_id))
  )
  with check (
    public.has_permission('attendance.manage')
    or (public.has_permission('attendance.manage_team') and public.is_manager_of(employee_id))
  );

-- ---------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------
drop policy if exists leave_select on public.leave_requests;
create policy leave_select on public.leave_requests for select to authenticated
  using (
    public.has_permission('leaves.view_all')
    or employee_id = public.current_employee_id()
    or (public.has_permission('leaves.view_team') and public.is_manager_of(employee_id))
  );

drop policy if exists leave_insert_self on public.leave_requests;
create policy leave_insert_self on public.leave_requests for insert to authenticated
  with check (
    employee_id = public.current_employee_id()
    or public.has_permission('leaves.manage')
  );

drop policy if exists leave_manage on public.leave_requests;
create policy leave_manage on public.leave_requests for all to authenticated
  using (
    public.has_permission('leaves.manage')
    or (public.has_permission('leaves.approve_team') and public.is_manager_of(employee_id))
  )
  with check (
    public.has_permission('leaves.manage')
    or (public.has_permission('leaves.approve_team') and public.is_manager_of(employee_id))
  );

-- ---------------------------------------------------------------------
-- evaluations
-- ---------------------------------------------------------------------
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select on public.evaluations for select to authenticated
  using (
    public.has_permission('evaluations.view_all')
    or evaluator_id = auth.uid()
    or (employee_id = public.current_employee_id()
        and (status = 'approved' or stage = 'self'))
    or (public.has_permission('evaluations.view_team') and public.is_manager_of(employee_id))
  );

drop policy if exists evaluations_insert on public.evaluations;
create policy evaluations_insert on public.evaluations for insert to authenticated
  with check (
    public.has_permission('evaluations.manage')
    -- an employee scoring themselves, when self assessment is enabled for them
    or (stage = 'self' and employee_id = public.current_employee_id()
        and public.has_permission('evaluations.self'))
    -- a manager scoring someone in their own reporting line, in any stage
    -- other than that person's own self assessment
    or (stage <> 'self'
        and public.has_permission('evaluations.evaluate_team')
        and public.is_manager_of(employee_id)
        and evaluator_id = auth.uid())
  );

-- An evaluator may revise their own evaluation until it is approved; after
-- approval only a holder of evaluations.manage can touch it.
drop policy if exists evaluations_update on public.evaluations;
create policy evaluations_update on public.evaluations for update to authenticated
  using (
    public.has_permission('evaluations.manage')
    or (evaluator_id = auth.uid() and status <> 'approved')
  )
  with check (
    public.has_permission('evaluations.manage')
    or evaluator_id = auth.uid()
  );

drop policy if exists evaluations_delete on public.evaluations;
create policy evaluations_delete on public.evaluations for delete to authenticated
  using (public.has_permission('evaluations.manage'));

drop policy if exists evaluation_scores_all on public.evaluation_scores;
create policy evaluation_scores_all on public.evaluation_scores for all to authenticated
  using (
    exists (select 1 from public.evaluations e where e.id = evaluation_id)
  )
  with check (
    exists (select 1 from public.evaluations e where e.id = evaluation_id)
  );
-- NOTE: the sub-select above is itself filtered by the evaluations policies,
-- so a user can only reach score rows of evaluations they may already see.

-- ---------------------------------------------------------------------
-- monthly_rankings — the ranking board is company-wide by design
-- ---------------------------------------------------------------------
drop policy if exists rankings_select on public.monthly_rankings;
create policy rankings_select on public.monthly_rankings for select to authenticated
  using (public.current_user_active());

drop policy if exists rankings_write on public.monthly_rankings;
create policy rankings_write on public.monthly_rankings for all to authenticated
  using (public.has_permission('ranking.manage'))
  with check (public.has_permission('ranking.manage'));

-- ---------------------------------------------------------------------
-- notifications — strictly per user
-- ---------------------------------------------------------------------
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid() and public.current_user_active());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_insert on public.notifications;
create policy notifications_insert on public.notifications for insert to authenticated
  with check (public.has_permission('notifications.send') or user_id = auth.uid());

-- ---------------------------------------------------------------------
-- audit_logs — append-only, readable with permission
-- ---------------------------------------------------------------------
drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated
  using (public.has_permission('audit.view'));

drop policy if exists audit_insert on public.audit_logs;
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- system_settings
-- ---------------------------------------------------------------------
drop policy if exists settings_select on public.system_settings;
create policy settings_select on public.system_settings for select to authenticated
  using (is_public or public.has_permission('settings.manage'));

drop policy if exists settings_write on public.system_settings;
create policy settings_write on public.system_settings for all to authenticated
  using (public.has_permission('settings.manage'))
  with check (public.has_permission('settings.manage'));

-- ---------------------------------------------------------------------
-- Minimal public directory view used by the ranking board and avatars.
-- Exposes name / photo / department only — never contact or HR data.
-- ---------------------------------------------------------------------
create or replace view public.v_employee_directory as
  select
    e.id,
    e.employee_code,
    e.full_name_en,
    e.full_name_ar,
    e.photo_url,
    e.job_title,
    e.frame_id,
    e.name_color,
    d.name_en as department_name_en,
    d.name_ar as department_name_ar,
    e.employment_status
  from public.employees e
  left join public.departments d on d.id = e.department_id
  where e.employment_status = 'active';

grant select on public.v_employee_directory to authenticated;

create or replace view public.v_monthly_ranking as
  select
    r.id, r.period_year, r.period_month, r.rank, r.final_score,
    r.attendance_score, r.punctuality_score, r.evaluation_score,
    r.is_employee_of_month,
    e.id as employee_id, e.full_name_en, e.full_name_ar, e.photo_url,
    e.frame_id, e.name_color,
    d.name_en as department_name_en, d.name_ar as department_name_ar
  from public.monthly_rankings r
  join public.employees e on e.id = r.employee_id
  left join public.departments d on d.id = e.department_id;

grant select on public.v_monthly_ranking to authenticated;
