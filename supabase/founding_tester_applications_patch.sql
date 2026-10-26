-- Bridgette Health Inc.
-- Patch: Founding Tester sign-ups become APPLICATIONS, approved by hand.
--
-- Run this AFTER founding_tester_consents.sql, in the Supabase SQL editor.
-- It is safe to run on the table you already created, and safe to re-run.
--
-- What changes:
--   1. Every row arrives as 'pending'. Nobody takes a slot by signing up.
--   2. You approve or decline each one yourself.
--   3. The public page shows an APPLICATION count, not slots claimed.

-- 1. Approval state ---------------------------------------------------------

alter table public.founding_tester_consents
  add column if not exists status       text not null default 'pending',
  add column if not exists reviewed_at  timestamptz,
  add column if not exists review_note  text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'founding_tester_consents_status_check'
  ) then
    alter table public.founding_tester_consents
      add constraint founding_tester_consents_status_check
      check (status in ('pending', 'approved', 'declined'));
  end if;
end $$;

create index if not exists founding_tester_consents_status_idx
  on public.founding_tester_consents (status);

-- Nobody can self-approve. The insert policy is rewritten to accept 'pending'
-- rows only, so a crafted request cannot arrive pre-approved.
drop policy if exists "submit a founding tester signup" on public.founding_tester_consents;
create policy "submit a founding tester application"
  on public.founding_tester_consents
  for insert
  to anon, authenticated
  with check (
    consent_health_data
    and consent_ai_processing
    and consent_terms_privacy
    and ack_beta
    and consent_feedback
    and agree_founding_terms
    and status = 'pending'
    and reviewed_at is null
    and withdrawn_at is null
    and cancelled_at is null
  );

-- 2. Public counters --------------------------------------------------------
-- Applications received. This is what the page shows. It returns an integer
-- only, so it exposes no row. The display offset lives in the page, not here,
-- so this function always tells you the true number.

create or replace function public.founding_tester_application_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.founding_tester_consents
  where tester_role = 'patient'
    and status <> 'declined'
    and withdrawn_at is null;
$$;

revoke all on function public.founding_tester_application_count() from public;
grant execute on function public.founding_tester_application_count() to anon, authenticated;

-- Approved testers. Used to close the programme once 50 are actually in.

create or replace function public.founding_tester_approved_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.founding_tester_consents
  where tester_role = 'patient'
    and status = 'approved'
    and withdrawn_at is null
    and cancelled_at is null;
$$;

revoke all on function public.founding_tester_approved_count() from public;
grant execute on function public.founding_tester_approved_count() to anon, authenticated;

-- The old function counted sign-ups as slots taken. Nothing calls it now.
drop function if exists public.founding_tester_slots_taken();

-- 3. Running the programme --------------------------------------------------
--
-- Your queue, oldest first:
--
-- select created_at, full_name, email, mobile, city, status
--   from public.founding_tester_consents
--  where status = 'pending' and withdrawn_at is null
--  order by created_at;
--
-- Approve someone:
--
-- update public.founding_tester_consents
--    set status = 'approved', reviewed_at = now(), review_note = 'Approved'
--  where lower(email) = lower('tester@example.com');
--
-- Decline someone. Declined rows stop counting as applications.
--
-- update public.founding_tester_consents
--    set status = 'declined', reviewed_at = now(), review_note = 'Not a fit'
--  where lower(email) = lower('tester@example.com');
--
-- Where the programme stands:
--
-- select status, count(*) from public.founding_tester_consents
--  where withdrawn_at is null group by status;
--
-- 4. Clear your test row ----------------------------------------------------
-- The sign-up you made while testing still counts as an application. Delete it
-- so the number starts clean, replacing the address with the one you used.
--
-- delete from public.founding_tester_consents
--  where lower(email) = lower('your-test@example.com');
