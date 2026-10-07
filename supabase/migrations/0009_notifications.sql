-- =====================================================================
-- Migration 0009 — Notification engine
--
-- Notifications are raised by the database, not by the client, so they
-- fire no matter how the underlying row was written — the app, an import
-- script, or the SQL editor.
-- =====================================================================

create or replace function public.notify_user(
  p_user_id uuid,
  p_title_en text,
  p_title_ar text,
  p_body_en text default null,
  p_body_ar text default null,
  p_type text default 'info',
  p_link text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_user_id is null then
    return;
  end if;
  insert into public.notifications (user_id, title_en, title_ar, body_en, body_ar, type, link)
  values (p_user_id, p_title_en, p_title_ar, p_body_en, p_body_ar, p_type, p_link);
end;
$$;

/** The login account attached to an employee, if they have one. */
create or replace function public.user_id_for_employee(p_employee_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select user_id from public.employees where id = p_employee_id;
$$;

-- ---------------------------------------------------------------------
-- Attendance: tell the employee when an absence or a late day is recorded
-- ---------------------------------------------------------------------
create or replace function public.notify_attendance_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid;
begin
  if new.status not in ('absent', 'late') then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = new.status then
    return new;
  end if;

  v_user := public.user_id_for_employee(new.employee_id);

  if new.status = 'absent' then
    perform public.notify_user(
      v_user,
      'An absence was recorded on your account',
      'تم تسجيل غياب جديد على حسابك',
      'Date: ' || new.work_date::text,
      'بتاريخ: ' || new.work_date::text,
      'attendance',
      '/attendance/absence'
    );
  else
    perform public.notify_user(
      v_user,
      'A late arrival was recorded on your account',
      'تم تسجيل تأخير على حسابك',
      'Date: ' || new.work_date::text,
      'بتاريخ: ' || new.work_date::text,
      'attendance',
      '/attendance/absence'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_attendance_change on public.attendance;
create trigger notify_attendance_change
  after insert or update on public.attendance
  for each row execute function public.notify_attendance_change();

-- ---------------------------------------------------------------------
-- Evaluations: the employee hears about approvals; the manager hears
-- about a self assessment landing in their queue.
-- ---------------------------------------------------------------------
create or replace function public.notify_evaluation_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_employee_user uuid;
  v_manager_user uuid;
begin
  v_employee_user := public.user_id_for_employee(new.employee_id);

  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    perform public.notify_user(
      v_employee_user,
      'Your monthly evaluation has been approved',
      'تم اعتماد تقييمك الشهري',
      'Score: ' || coalesce(new.percentage, 0)::text || '%',
      'النتيجة: ' || coalesce(new.percentage, 0)::text || '%',
      'evaluation',
      '/evaluations/mine'
    );
  end if;

  if new.stage = 'self'
     and new.status = 'submitted'
     and (tg_op = 'INSERT' or old.status is distinct from 'submitted')
  then
    select public.user_id_for_employee(e.manager_id)
      into v_manager_user
    from public.employees e
    where e.id = new.employee_id;

    perform public.notify_user(
      v_manager_user,
      'A self assessment is waiting for your review',
      'لديك تقييم جديد مطلوب منك',
      null, null,
      'evaluation',
      '/evaluations/team'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notify_evaluation_change on public.evaluations;
create trigger notify_evaluation_change
  after insert or update on public.evaluations
  for each row execute function public.notify_evaluation_change();

-- ---------------------------------------------------------------------
-- Leave decisions
-- ---------------------------------------------------------------------
create or replace function public.notify_leave_decision()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid;
begin
  if old.status = new.status or new.status not in ('approved', 'rejected') then
    return new;
  end if;

  v_user := public.user_id_for_employee(new.employee_id);

  perform public.notify_user(
    v_user,
    case when new.status = 'approved' then 'Your leave request was approved'
         else 'Your leave request was rejected' end,
    case when new.status = 'approved' then 'تمت الموافقة على طلب إجازتك'
         else 'تم رفض طلب إجازتك' end,
    new.start_date::text || ' → ' || new.end_date::text,
    new.start_date::text || ' → ' || new.end_date::text,
    case when new.status = 'approved' then 'success' else 'warning' end,
    '/attendance/leaves'
  );

  return new;
end;
$$;

drop trigger if exists notify_leave_decision on public.leave_requests;
create trigger notify_leave_decision
  after update on public.leave_requests
  for each row execute function public.notify_leave_decision();

-- ---------------------------------------------------------------------
-- Monthly ranking: publish and congratulate
-- ---------------------------------------------------------------------
create or replace function public.notify_ranking_published()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := public.user_id_for_employee(new.employee_id);
begin
  if new.is_employee_of_month then
    perform public.notify_user(
      v_user,
      'Congratulations — you are Employee of the Month!',
      'مبروك! حصلت على لقب موظف الشهر',
      'Score: ' || new.final_score::text || '%',
      'النتيجة: ' || new.final_score::text || '%',
      'ranking',
      '/ranking'
    );
  else
    perform public.notify_user(
      v_user,
      'Your monthly ranking has been published',
      'تم إصدار تقييمك الشهري',
      'Rank: ' || coalesce(new.rank, 0)::text,
      'الترتيب: ' || coalesce(new.rank, 0)::text,
      'ranking',
      '/ranking'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_ranking_published on public.monthly_rankings;
create trigger notify_ranking_published
  after insert on public.monthly_rankings
  for each row execute function public.notify_ranking_published();

-- ---------------------------------------------------------------------
-- Employee-of-the-month badge, awarded automatically with the ranking
-- ---------------------------------------------------------------------
create or replace function public.award_employee_of_month_badge()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_badge uuid;
begin
  if not new.is_employee_of_month then
    return new;
  end if;

  select id into v_badge from public.badges where key = 'employee_of_month';
  if v_badge is null then
    return new;
  end if;

  -- Only the current holder keeps the badge.
  delete from public.employee_badges where badge_id = v_badge;

  insert into public.employee_badges (employee_id, badge_id, note)
  values (
    new.employee_id,
    v_badge,
    new.period_year::text || '-' || lpad(new.period_month::text, 2, '0')
  )
  on conflict (employee_id, badge_id) do nothing;

  return new;
end;
$$;

drop trigger if exists award_employee_of_month_badge on public.monthly_rankings;
create trigger award_employee_of_month_badge
  after insert on public.monthly_rankings
  for each row execute function public.award_employee_of_month_badge();

-- ---------------------------------------------------------------------
-- Mark every notification of the signed-in user as read
-- ---------------------------------------------------------------------
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  v_count integer;
begin
  update public.notifications
     set is_read = true
   where user_id = auth.uid() and is_read = false;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
