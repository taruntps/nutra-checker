-- Atomic OTP attempt increment.
-- Returns the NEW attempts count after increment, or -1 if already at max
-- (meaning the session was not incremented and should be rejected).
-- Using a single UPDATE avoids the read-then-write race in application code.

create or replace function public.otp_increment_attempt(p_id uuid, p_max integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new integer;
begin
  update public.otp_sessions
     set attempts = attempts + 1
   where id = p_id
     and used = false
     and attempts < p_max
  returning attempts into v_new;

  -- If no row updated, the session was already at max attempts
  return coalesce(v_new, -1);
end;
$$;

revoke all on function public.otp_increment_attempt(uuid, integer) from public, anon, authenticated;
grant execute on function public.otp_increment_attempt(uuid, integer) to service_role;
