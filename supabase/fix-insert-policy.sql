-- ============================================================================
-- Allow signed-in users to register too.
--
-- Run in the Supabase SQL Editor, after schema.sql. Safe to re-run.
--
-- Why: schema.sql granted INSERT `to anon` only. The admin console keeps a
-- persistent Supabase session, so once an admin has logged in, every request
-- from that browser carries the `authenticated` role instead of `anon` --
-- including the public registration form. With no INSERT policy for that role,
-- Postgres denies the write with 42501 and the form reports that registration
-- is blocked by database permissions.
--
-- Anonymous visitors were never affected; this only ever hit logged-in admins.
--
-- INSERT only. There is still no SELECT policy for anon or plain authenticated
-- users, so the roster stays unreadable to everyone except the emails listed
-- in public.admins (see admin.sql).
-- ============================================================================

drop policy if exists "anon can register" on public.registrations;
drop policy if exists "anyone can register" on public.registrations;

create policy "anyone can register"
  on public.registrations
  for insert
  to anon, authenticated
  with check (true);

-- Check it worked -- expect one INSERT policy covering {anon,authenticated}:
--   select policyname, cmd, roles from pg_policies
--   where tablename = 'registrations';
