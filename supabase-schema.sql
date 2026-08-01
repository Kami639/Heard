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
