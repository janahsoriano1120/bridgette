-- Run once in Supabase > SQL Editor. Safe to run again: every line is "if not exists".
-- Covers every field the form sends, including the earlier questionnaire columns.
alter table founding_tester_consents
  add column if not exists phone_platform text,
  add column if not exists specialists_seen text[],
  add column if not exists records_location text[],
  add column if not exists lifestyle text,
  add column if not exists tracks_already text[],
  add column if not exists eating_pattern text,
  add column if not exists household_size text,
  add column if not exists works_abroad boolean,
  add column if not exists caregiver_for_other boolean,
  add column if not exists motivation text,
  add column if not exists social_handle text,
  add column if not exists preferred_channel text,
  add column if not exists health_conditions text[],
  add column if not exists takes_medicines text,
  add column if not exists regular_doctor text,
  add column if not exists lives_in_ph boolean,
  add column if not exists language text,
  add column if not exists phone_model text,
  add column if not exists connectivity text,
  add column if not exists will_use_real_records text,
  add column if not exists time_commitment text,
  add column if not exists other_apps text,
  add column if not exists heard_from text,
  add column if not exists lab_frequency text,
  add column if not exists if_not_selected text,
  add column if not exists consent_quote boolean default false,
  add column if not exists consent_call_recording boolean default false,
  add column if not exists consent_marketing boolean default false;

-- Allowed values for the "if you are not picked" answer
alter table founding_tester_consents drop constraint if exists founding_tester_if_not_selected_check;
alter table founding_tester_consents
  add constraint founding_tester_if_not_selected_check
  check (if_not_selected is null or if_not_selected in ('waitlist','signup_later','delete'));
