-- AI usage rate-limit table: tracks per-user daily AI calls.
-- Written by edge functions (service role) via increment_ai_usage() RPC.

create table if not exists public.ai_usage (
  user_id           uuid    not null references auth.users(id) on delete cascade,
  call_date         date    not null default current_date,
  ai_suggest_calls  integer not null default 0,
  extract_calls     integer not null default 0,
  primary key (user_id, call_date)
);

alter table public.ai_usage enable row level security;
-- No client policies: only service role (edge functions) reads/writes this table.

-- Atomic increment for one call kind; returns the new count after increment.
-- kind: 'suggest' | 'extract'
create or replace function public.increment_ai_usage(
  p_user_id uuid,
  p_kind    text
) returns integer
language plpgsql security definer as $$
declare
  v_count integer;
begin
  insert into public.ai_usage (user_id, call_date, ai_suggest_calls, extract_calls)
  values (
    p_user_id,
    current_date,
    case when p_kind = 'suggest' then 1 else 0 end,
    case when p_kind = 'extract' then 1 else 0 end
  )
  on conflict (user_id, call_date) do update set
    ai_suggest_calls = ai_usage.ai_suggest_calls + case when p_kind = 'suggest' then 1 else 0 end,
    extract_calls    = ai_usage.extract_calls    + case when p_kind = 'extract' then 1 else 0 end
  returning
    case when p_kind = 'suggest' then ai_usage.ai_suggest_calls else ai_usage.extract_calls end
  into v_count;
  return coalesce(v_count, 1);
end;
$$;
