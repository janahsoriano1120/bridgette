-- Bridgette Health Inc.
-- Founding Tester sign-ups (patient cohort)
--
-- Purpose: evidence of consent under the Data Privacy Act of 2012, and the
-- record of what each tester was promised. The DPA requires consent to be
-- freely given, specific, informed, and evidenced by written, electronic, or
-- recorded means. This table is that evidence, so it records WHAT was agreed
-- to (the document versions), WHEN, and BY WHOM, not just a boolean.
--
-- All six agreements are required. A row that does not carry all six cannot
-- be written, enforced twice: once in a CHECK constraint, once in the RLS
-- insert policy.
--
-- Run in the Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.founding_tester_consents (
  id                        uuid primary key default gen_random_uuid(),
  created_at                timestamptz not null default now(),

  -- Identity
  full_name                 text not null,
  email                     text not null,
  mobile                    text,
  date_of_birth             date not null,
  city                      text,
  tester_role               text not null default 'patient',

  -- The six required agreements
  consent_health_data       boolean not null,  -- hold and process health data
  consent_ai_processing     boolean not null,  -- AI use incl. cross-border transfer
  consent_terms_privacy     boolean not null,  -- read Privacy Notice and Terms
  ack_beta                  boolean not null,  -- beta software, not a medical device
  consent_feedback          boolean not null,  -- will report bugs, we use the feedback
  agree_founding_terms      boolean not null,  -- 3 months free, 33% off, freeze and cancel rules

  -- Audit trail: which versions of the documents they actually saw
  consent_form_version      text not null,
  privacy_notice_version    text not null,
  terms_version             text not null,
  user_agent                text,
  consented_at              timestamptz not null default now(),

  -- Programme state. Set these from the dashboard as things change.
  -- frozen_until: account paused, discount retained, max three months.
  -- cancelled_at: discount ends here and is not restorable.
  -- withdrawn_at: consent withdrawn, account to be exported then deleted.
  frozen_until              date,
  cancelled_at              timestamptz,
  withdrawn_at              timestamptz,
  status_note               text,

  constraint founding_tester_consents_role_check
    check (tester_role in ('patient', 'provider', 'caregiver')),

  constraint founding_tester_consents_all_six_check
    check (
      consent_health_data
      and consent_ai_processing
      and consent_terms_privacy
      and ack_beta
      and consent_feedback
      and agree_founding_terms
    ),

  -- 18 and over. The form checks this too, but the database is the backstop.
  constraint founding_tester_consents_age_check
    check (date_of_birth <= (current_date - interval '18 years'))
);

-- One active sign-up per email. Someone who withdrew or cancelled does not
-- block a future row, which keeps the audit history intact.
create unique index if not exists founding_tester_consents_email_active_idx
  on public.founding_tester_consents (lower(email))
  where withdrawn_at is null and cancelled_at is null;

create index if not exists founding_tester_consents_created_at_idx
  on public.founding_tester_consents (created_at desc);

-- Row Level Security -------------------------------------------------------
-- Anyone may sign up. Nobody may read a record back through the anon key:
-- there is no select policy, so the table is write-only from the browser.
-- Read it in the Supabase dashboard or with the service role key, which
-- bypasses RLS and must never be shipped in the page.

alter table public.founding_tester_consents enable row level security;

drop policy if exists "submit a founding tester signup" on public.founding_tester_consents;
create policy "submit a founding tester signup"
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
    and withdrawn_at is null
    and cancelled_at is null
  );

-- Slot counter -------------------------------------------------------------
-- The page shows how many of the 50 patient slots are left. This returns only
-- an integer, so the count can be public without exposing any row. A cancelled
-- or withdrawn tester frees their slot.

create or replace function public.founding_tester_slots_taken()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.founding_tester_consents
  where tester_role = 'patient'
    and withdrawn_at is null
    and cancelled_at is null;
$$;

revoke all on function public.founding_tester_slots_taken() from public;
grant execute on function public.founding_tester_slots_taken() to anon, authenticated;

-- Day to day ---------------------------------------------------------------
-- Freeze an account, keeping the discount. Max three months.
--
-- update public.founding_tester_consents
--    set frozen_until = (current_date + interval '3 months')::date,
--        status_note  = 'Frozen at tester request'
--  where lower(email) = lower('tester@example.com');
--
-- Cancel. The Founding Tester discount ends here and is not restorable.
--
-- update public.founding_tester_consents
--    set cancelled_at = now(),
--        status_note  = 'Cancelled by tester, founding rate forfeited'
--  where lower(email) = lower('tester@example.com');
--
-- Withdraw consent. Export their data first, then delete the account.
-- The row stays: the record that consent once existed is itself required.
--
-- update public.founding_tester_consents
--    set withdrawn_at = now(),
--        status_note  = 'Consent withdrawn by email request'
--  where lower(email) = lower('tester@example.com');
--
-- Who is active right now.
--
-- select full_name, email, created_at, frozen_until
--   from public.founding_tester_consents
--  where withdrawn_at is null and cancelled_at is null
--  order by created_at;
