-- Regulyze: admin RPCs for changing privileged profile columns.
-- After 20260619_profiles_column_lockdown.sql, the `authenticated` role can no
-- longer UPDATE plan/plan_checks/used/status/plan_expires_at directly. The admin
-- panel previously wrote those columns with the authenticated client, which now
-- fails. These SECURITY DEFINER functions re-enable admin actions while keeping
-- the columns locked for ordinary users (the function checks is_admin()).
--
-- Run in the Supabase SQL editor. Safe to re-run.

create or replace function public.admin_set_plan(p_user uuid, p_plan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checks integer;
  v_days   integer;
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  v_checks := case p_plan
    when 'free' then 5
    when 'basic' then 10
    when 'pro' then 50
    when 'monthly' then 500
    when 'unlimited' then 99999
    when 'enterprise' then 99999
    else 5
  end;
  v_days := case p_plan when 'monthly' then 30 when 'unlimited' then 180 else null end;

  update public.profiles
     set plan = p_plan,
         plan_checks = v_checks,
         used = 0,
         plan_expires_at = case when v_days is null then null
                                else now() + (v_days || ' days')::interval end
   where id = p_user;
end;
$$;

create or replace function public.admin_set_status(p_user uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;
  if p_status not in ('active', 'suspended') then
    raise exception 'invalid status';
  end if;
  update public.profiles set status = p_status where id = p_user;
end;
$$;

revoke all on function public.admin_set_plan(uuid, text) from public, anon;
revoke all on function public.admin_set_status(uuid, text) from public, anon;
grant execute on function public.admin_set_plan(uuid, text) to authenticated;
grant execute on function public.admin_set_status(uuid, text) to authenticated;
