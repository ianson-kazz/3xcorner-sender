-- Run this once in the Supabase SQL editor for project hrcbpdsqjaiuevtwdpfb.
-- It creates the two tables the notification system uses.

create table if not exists public.messages (
  id           bigint generated always as identity primary key,
  day_number   integer not null unique,
  title        text    not null,
  body         text    not null,
  image_url    text,
  link_url     text    not null,
  created_at   timestamptz default now()
);

create table if not exists public.subscribers (
  id            bigint generated always as identity primary key,
  fcm_token     text        not null unique,
  timezone      text        not null default 'UTC',
  messages_sent integer     not null default 0,
  last_sent_at  timestamptz,
  created_at    timestamptz default now()
);

-- The browser on "Page B" (updates-noti.html) inserts with the anon key,
-- so an INSERT policy is required for the subscribe call to succeed.
alter table public.messages    enable row level security;
alter table public.subscribers enable row level security;

drop policy if exists "anon can subscribe" on public.subscribers;
create policy "anon can subscribe"
  on public.subscribers
  for insert
  to anon
  with check (true);

-- Optional: lets the page update an existing row for the same device token
-- instead of failing on the unique constraint (recommended).
drop policy if exists "anon can refresh own row" on public.subscribers;
create policy "anon can refresh own row"
  on public.subscribers
  for update
  to anon
  using (true)
  with check (true);

-- Optional: public read of the message queue (the worker only needs service_role).
drop policy if exists "anon can read messages" on public.messages;
create policy "anon can read messages"
  on public.messages
  for select
  to anon
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION — only needed if the tables already existed from an earlier setup.
-- ─────────────────────────────────────────────────────────────────────────────
-- The live subscribers table currently exposes:
--   id, fcm_token, timezone, created_at, last_sent_date
-- So the per-subscriber message counter does not exist yet. send.js measures
-- progress from whichever column is present (messages_sent if it exists,
-- otherwise last_sent_date), so it runs on either schema. If you would rather
-- have the plain counter as well, run:
--
--   alter table public.subscribers
--     add column if not exists messages_sent   integer not null default 0,
--     add column if not exists last_sent_at    timestamptz,
--     add column if not exists last_sent_date  date;
--
-- (Postgres does not allow table constraints to be read directly through
-- PostgREST, so send.js probes the columns at runtime instead — that keeps the
-- sender working even if this migration is never applied.)