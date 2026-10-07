-- =====================================================================
-- Migration 0008 — First-run bootstrap
--
-- After you create the very first account through the app's login screen
-- (or in Supabase → Authentication → Users), call:
--
--     select public.bootstrap_first_admin('you@company.com');
--
-- It only works while no administrator exists yet, so it cannot be used
-- to escalate privileges later.
-- =====================================================================

create or replace function public.bootstrap_first_admin(p_email text)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user_id  uuid;
  v_admin_id uuid;
  v_emp_id   uuid;
begin
  if exists (
    select 1 from public.users u
    join public.roles r on r.id = u.role_id
    where r.key = 'admin'
  ) then
    return 'An administrator already exists — bootstrap is disabled.';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then
    return 'No auth user found with that email. Create the account first.';
  end if;

  select id into v_admin_id from public.roles where key = 'admin';

  insert into public.users (id, email, username, role_id, is_active)
  values (v_user_id, p_email, split_part(p_email, '@', 1), v_admin_id, true)
  on conflict (id) do update set role_id = v_admin_id, is_active = true;

  select id into v_emp_id from public.employees where user_id = v_user_id;
  if v_emp_id is null then
    insert into public.employees
      (user_id, employee_code, full_name_en, email, job_title, employment_status, joining_date)
    values
      (v_user_id, 'EMP-0001', split_part(p_email, '@', 1), p_email,
       'System Administrator', 'active', current_date);
  end if;

  return 'Done. ' || p_email || ' is now the system administrator.';
end;
$$;

grant execute on function public.bootstrap_first_admin(text) to authenticated, anon;

-- ---------------------------------------------------------------------
-- Convenience: keep employees.email in sync with the linked user
-- ---------------------------------------------------------------------
create or replace function public.sync_employee_email()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.user_id is not null and (new.email is null or new.email = '') then
    select email into new.email from public.users where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_employee_email on public.employees;
create trigger sync_employee_email
  before insert or update on public.employees
  for each row execute function public.sync_employee_email();
