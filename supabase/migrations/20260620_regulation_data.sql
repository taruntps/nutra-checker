-- Regulation data table: mirrors Google Sheet tabs for FSSAI regulation data.
-- The app reads from here first (fast, no CORS proxies); falls back to Google Sheet.
-- The Google Apps Script sync trigger writes here via the sync-regulations edge function.

create table if not exists public.regulation_data (
  tab_name    text    not null,
  row_index   integer not null,
  data        jsonb   not null,
  updated_at  timestamptz not null default now(),
  primary key (tab_name, row_index)
);

-- RLS: anyone with the anon key can read (needed by the SPA).
-- Only the service role (edge function) can insert/update/delete.
alter table public.regulation_data enable row level security;

drop policy if exists "Public read regulation data" on public.regulation_data;
create policy "Public read regulation data"
  on public.regulation_data for select using (true);

-- Fast lookup by tab + row order
create index if not exists idx_regulation_data_tab
  on public.regulation_data(tab_name, row_index);
