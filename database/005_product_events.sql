-- Minimal first-party product analytics for validating the Kelus learning loop.
-- Events contain behavioral metadata only; answers and material contents are
-- deliberately excluded. RLS prevents users from reading or writing another
-- learner's events.
create table if not exists product_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name in (
    'setup_completed',
    'material_map_confirmed',
    'diagnosis_completed',
    'session_started',
    'answer_evaluated',
    'route_recalculated',
    'session_completed'
  )),
  analytics_session_id uuid not null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table product_events enable row level security;
create index if not exists product_events_user_time_idx on product_events (user_id, occurred_at desc);
create index if not exists product_events_name_time_idx on product_events (event_name, occurred_at desc);

drop policy if exists "product_events_insert_own" on product_events;
drop policy if exists "product_events_select_own" on product_events;
create policy "product_events_insert_own" on product_events for insert
with check (auth.uid() = user_id);
create policy "product_events_select_own" on product_events for select
using (auth.uid() = user_id);

