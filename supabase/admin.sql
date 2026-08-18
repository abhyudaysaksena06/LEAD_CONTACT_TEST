-- ============================================================================
-- LEAD 2026 — admin read access for /admin
--
-- Run this in the Supabase SQL Editor AFTER schema.sql.
-- Safe to re-run.
--
-- Model: the registrations table stays unreadable to the public anon key.
-- Read access is granted only to logged-in users whose email appears in
-- public.admins. That check runs inside the database, so it cannot be
-- bypassed from the browser.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Allow-list of admin emails
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- No policies are defined for this table, and RLS is on, so it is invisible
-- through the public API. Manage it from the dashboard / SQL editor only.
alter table public.admins enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Admin check
--
-- SECURITY DEFINER so the lookup runs as the function owner. Without this the
-- policy below would re-enter RLS on public.admins, find nothing, and deny
-- everyone.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Policies on registrations
--
-- anon  -> INSERT only (from schema.sql), still no read.
-- admin -> SELECT and DELETE.
-- ---------------------------------------------------------------------------
drop policy if exists "admins can read registrations" on public.registrations;
create policy "admins can read registrations"
  on public.registrations
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admins can delete registrations" on public.registrations;
create policy "admins can delete registrations"
  on public.registrations
  for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. Realtime
--
-- Lets /admin receive new rows as they are inserted. Realtime respects RLS,
-- so only admins receive the payloads.
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table public.registrations;
exception
  when duplicate_object then null;  -- already added
end $$;

-- ---------------------------------------------------------------------------
-- 5. YOUR ADMIN EMAIL  <-- EDIT THIS LINE
--
-- Must match the email of a user created under Authentication -> Users.
-- ---------------------------------------------------------------------------
insert into public.admins (email)
values ('abhyuday.saksena06@gmail.com')
on conflict (email) do nothing;

-- Check it worked:
--   select * from public.admins;
