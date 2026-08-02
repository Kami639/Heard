-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run

create table if not exists concerts (
  id text primary key,
  user_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table concerts enable row level security;

create policy "own concerts" on concerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Media bucket (photos + videos), public read, per-user write
insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do nothing;

create policy "media upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "media read" on storage.objects
  for select using (bucket_id = 'media');

create policy "media delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

-- Shared archives (v91): a read-only snapshot published under a short code.
-- Anyone with the code can read it; only the owner can write or delete it.
create table if not exists shared_archives (
  code text primary key,
  user_id uuid not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table shared_archives enable row level security;

create policy "anyone can read shared archives" on shared_archives
  for select using (true);

create policy "owners manage their shared archive" on shared_archives
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════
-- v101 additions. Safe to re-run; everything is IF NOT EXISTS / OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════

-- Badge rarity: each signed-in user mirrors their unlocked badge ids here,
-- and an aggregate tells everyone what fraction of users hold each badge.
create table if not exists badge_unlocks (
  user_id uuid not null,
  badge_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table badge_unlocks enable row level security;

drop policy if exists "own badges" on badge_unlocks;
create policy "own badges" on badge_unlocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Aggregate readable by everyone (security definer sidesteps RLS for the
-- COUNT only — no individual rows leak).
create or replace function badge_rarity()
returns table (badge_id text, holders bigint, total bigint)
language sql security definer stable
as $$
  select b.badge_id,
         count(distinct b.user_id) as holders,
         (select count(distinct user_id) from badge_unlocks) as total
  from badge_unlocks b
  group by b.badge_id;
$$;

grant execute on function badge_rarity() to anon, authenticated;

-- Web Push subscriptions (one row per browser endpoint).
create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "own subscriptions" on push_subscriptions;
create policy "own subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- "Who else was in the room": shared archives carry normalized show keys
-- ("artist|date") so a public profile can be matched to a specific night.
alter table shared_archives add column if not exists show_keys jsonb not null default '[]';
create index if not exists shared_archives_show_keys on shared_archives using gin (show_keys);
