-- One row per subject (e.g. 'math', 'la') holding everything the tracker
-- needs, so every device reads and writes the same counts.
create table if not exists public.subject_state (
  id text primary key check (id in ('math', 'la')),
  remaining integer not null default 0 check (remaining >= 0),
  log jsonb not null default '{}'::jsonb,
  daily_goal integer,
  last_synced_log_total integer not null default 0,
  updated_at timestamptz not null default now()
);

-- The app has no login: anyone with the site (and so the publishable key)
-- can read and update these two rows. The id check above keeps it from
-- being used to store anything else.
alter table public.subject_state enable row level security;

create policy "anyone can read subject state"
  on public.subject_state for select
  to anon, authenticated
  using (true);

create policy "anyone can insert subject state"
  on public.subject_state for insert
  to anon, authenticated
  with check (true);

create policy "anyone can update subject state"
  on public.subject_state for update
  to anon, authenticated
  using (true)
  with check (true);

-- Push changes to other open devices live.
alter publication supabase_realtime add table public.subject_state;
