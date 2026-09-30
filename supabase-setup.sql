-- Quizmaxxing: run this once in Supabase → SQL Editor → New query → Run.
-- Every row belongs to the logged-in user, and row-level security makes sure
-- nobody else (including anyone holding the public anon key) can read or change it.

create table if not exists public.quizzes (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

create table if not exists public.attempts (
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (owner, id)
);

create table if not exists public.user_state (
  owner uuid primary key default auth.uid() references auth.users on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  ai_key text,
  updated_at timestamptz not null default now()
);

alter table public.quizzes enable row level security;
alter table public.attempts enable row level security;
alter table public.user_state enable row level security;

drop policy if exists "own quizzes" on public.quizzes;
create policy "own quizzes" on public.quizzes for all
  using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "own attempts" on public.attempts;
create policy "own attempts" on public.attempts for all
  using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "own state" on public.user_state;
create policy "own state" on public.user_state for all
  using (owner = auth.uid()) with check (owner = auth.uid());
