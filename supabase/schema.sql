-- ============================================================================
-- LEAD 2026 — registrations table
--
-- Run this once in the Supabase dashboard:
--   your project -> SQL Editor -> New query -> paste -> Run
--
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

create table if not exists public.registrations (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  full_name        text not null,
  phone            text not null,
  email            text not null,
  admission_number text not null,
  branch           text not null,

  -- Basic server-side sanity checks. The form validates too, but the client
  -- can be bypassed, so the real constraints live here.
  constraint registrations_full_name_len   check (char_length(trim(full_name)) between 2 and 100),
  constraint registrations_phone_format    check (phone ~ '^[0-9]{10}$'),
  constraint registrations_email_format    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$'),
  constraint registrations_admission_len   check (char_length(trim(admission_number)) between 3 and 30),
  constraint registrations_branch_len      check (char_length(trim(branch)) between 2 and 60)
);

-- One registration per admission number. The form surfaces the resulting
-- 23505 unique-violation as a friendly "already registered" message.
create unique index if not exists registrations_admission_number_key
  on public.registrations (lower(trim(admission_number)));

create index if not exists registrations_created_at_idx
  on public.registrations (created_at desc);

-- ============================================================================
-- Row Level Security
--
-- The anon key ships in the browser bundle, so RLS is what actually protects
-- this table. Anonymous visitors may INSERT their own registration and nothing
-- else -- no SELECT, so nobody can read the roster (names, phones, emails)
-- from the public key. Read it from the dashboard, or via the service_role key
-- on a trusted server only.
-- ============================================================================

alter table public.registrations enable row level security;

-- INSERT is granted to authenticated as well as anon: the admin console keeps a
-- persistent session, so an admin browsing the public form sends the
-- authenticated role rather than anon, and an anon-only policy would deny it.
drop policy if exists "anon can register" on public.registrations;
drop policy if exists "anyone can register" on public.registrations;
create policy "anyone can register"
  on public.registrations
  for insert
  to anon, authenticated
  with check (true);

-- Deliberately NO select/update/delete policy for anon or authenticated.
-- With RLS enabled and no matching policy, those operations are denied.
