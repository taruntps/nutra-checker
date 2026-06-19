-- Regulyze security hardening migration
-- Run this in the Supabase SQL editor. Safe to re-run (idempotent).

-- 1) Payment replay protection -------------------------------------------------
-- verify-payment claims each razorpay_payment_id here before granting a plan.
-- payment_id is the PRIMARY KEY, so a replayed payment hits a unique violation.
create table if not exists public.processed_payments (
  payment_id  text primary key,
  order_id    text not null,
  user_id     uuid references auth.users(id) on delete set null,
  plan        text,
  created_at  timestamptz not null default now()
);
alter table public.processed_payments enable row level security;
-- No policies => only the service role (edge functions) can read/write. Clients
-- with the anon key get nothing, which is exactly what we want.

-- 2) OTP sessions table (create if it does not already exist) ------------------
create table if not exists public.otp_sessions (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  otp_hash    text not null,
  purpose     text not null check (purpose in ('reset','signup')),
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- OTP brute-force counter
alter table public.otp_sessions
  add column if not exists attempts integer not null default 0;

-- 3) Lock down otp_sessions to the service role only ---------------------------
-- The table is only ever touched by send-otp / verify-otp-custom (service role).
-- Ensure RLS is on and there are no permissive client policies.
alter table public.otp_sessions enable row level security;
do $$
declare p record;
begin
  for p in select policyname from pg_policies
           where schemaname='public' and tablename='otp_sessions'
  loop
    execute format('drop policy if exists %I on public.otp_sessions', p.policyname);
  end loop;
end $$;

-- 4) Helpful indexes -----------------------------------------------------------
create index if not exists idx_otp_email_created on public.otp_sessions(email, created_at);
create index if not exists idx_otp_lookup on public.otp_sessions(email, purpose, used, expires_at);

-- 5) Profiles RLS sanity (verify, do not blindly overwrite) ---------------------
-- Confirm a user can only read/update their OWN profile, and only admins read all.
-- Inspect with:
--   select policyname, cmd, qual, with_check from pg_policies where tablename='profiles';
-- Expected:
--   * SELECT  own : (auth.uid() = id)
--   * UPDATE  own : (auth.uid() = id)            with check (auth.uid() = id)
--   * SELECT  admin: is_admin()
-- If a profile UPDATE policy lets users change their own plan / plan_checks,
-- restrict those columns to the service role (handled by verify-payment).
