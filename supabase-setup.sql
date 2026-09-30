-- Run this once in Supabase → SQL Editor → New query → Run.
-- Creates the tables and locks them so each person can only see their own stuff.

create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  emoji text default '📚',
  color text default 'pink',
  created_at timestamptz not null default now()
);

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  course_id uuid not null references courses on delete cascade,
  title text not null default '',
  body text not null default '',
  mood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table courses enable row level security;
alter table notes enable row level security;

create policy "own courses" on courses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own notes" on notes for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
