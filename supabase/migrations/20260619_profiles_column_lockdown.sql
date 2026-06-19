-- Regulyze: lock down which profile columns an end-user can change.
-- Run in the Supabase SQL editor. Safe to re-run.
--
-- Even if a row-level policy lets a user UPDATE their own profile row, this
-- restricts WHICH columns they can write. Privileged columns (plan, plan_checks,
-- used, is_admin, status, username, plan_expires_at, email) become writable only
-- by the service role — i.e. only the edge functions (verify-payment,
-- admin-create-user, consume_check) can change them.
--
-- The app's profile editor only writes name/mobile/company, so normal use is
-- unaffected. The service role bypasses both RLS and column grants.

alter table public.profiles enable row level security;

-- Remove the broad table-level UPDATE, then grant back only the safe columns.
revoke update on public.profiles from authenticated;
grant  update (name, mobile, company) on public.profiles to authenticated;

-- (anon should never update profiles at all)
revoke update on public.profiles from anon;

-- Verify afterwards:
--   select grantee, privilege_type, column_name
--   from information_schema.column_privileges
--   where table_name='profiles' and grantee in ('authenticated','anon');
