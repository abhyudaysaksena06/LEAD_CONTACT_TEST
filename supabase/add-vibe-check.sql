-- ============================================================================
-- Adds the "Coke + Maggi — hear me out…" question to registrations.
--
-- Run in the Supabase SQL Editor, after schema.sql. Safe to re-run.
--
-- The column is nullable so that rows created before this migration stay
-- valid; the form requires an answer, and the CHECK below rejects anything
-- that is not one of the four options.
-- ============================================================================

alter table public.registrations
  add column if not exists vibe_check text;

alter table public.registrations
  drop constraint if exists registrations_vibe_check_valid;

alter table public.registrations
  add constraint registrations_vibe_check_valid
  check (
    vibe_check is null
    or vibe_check in (
      'Absolutely not',
      'Weirdly valid',
      'I need to try this',
      'Who hurt you?'
    )
  );

-- Check it worked:
--   select vibe_check, count(*) from public.registrations group by vibe_check;
