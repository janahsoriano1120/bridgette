-- Admin page setup. Run once in Supabase > SQL Editor. Safe to run again.

-- 1. Who counts as an admin
create table if not exists admins (user_id uuid primary key references auth.users(id) on delete cascade);
alter table admins enable row level security;
drop policy if exists "admins read own row" on admins;
create policy "admins read own row" on admins for select to authenticated using (user_id = auth.uid());

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from admins where user_id = auth.uid()) $$;

-- 2. Review columns on applications
alter table founding_tester_consents
  add column if not exists status text not null default 'pending',
  add column if not exists reviewed_at timestamptz,
  add column if not exists admin_note text;
alter table founding_tester_consents drop constraint if exists founding_tester_status_check;
alter table founding_tester_consents add constraint founding_tester_status_check check (status in ('pending','approved','declined'));

-- 3. Applicants can never set their own status or notes (they only ever insert)
create or replace function lock_review_fields() returns trigger
language plpgsql security definer set search_path = public as
$$ begin
  if not is_admin() then new.status := 'pending'; new.reviewed_at := null; new.admin_note := null; end if;
  return new;
end $$;
drop trigger if exists lock_review_fields_ins on founding_tester_consents;
create trigger lock_review_fields_ins before insert on founding_tester_consents for each row execute function lock_review_fields();

-- 4. Only admins can read, update or delete applications
alter table founding_tester_consents enable row level security;
drop policy if exists "admin select applications" on founding_tester_consents;
drop policy if exists "admin update applications" on founding_tester_consents;
drop policy if exists "admin delete applications" on founding_tester_consents;
create policy "admin select applications" on founding_tester_consents for select to authenticated using (is_admin());
create policy "admin update applications" on founding_tester_consents for update to authenticated using (is_admin()) with check (is_admin());
create policy "admin delete applications" on founding_tester_consents for delete to authenticated using (is_admin());

-- 5. Only admins can read or remove waitlist rows (public sign up stays insert-only)
alter table waitlist enable row level security;
drop policy if exists "admin select waitlist" on waitlist;
drop policy if exists "admin delete waitlist" on waitlist;
create policy "admin select waitlist" on waitlist for select to authenticated using (is_admin());
create policy "admin delete waitlist" on waitlist for delete to authenticated using (is_admin());

-- 6. Make YOU an admin. First create the user: Supabase > Authentication > Users > Add user
--    (use your email and a strong password, tick "Auto confirm"). Then change the email below and run:
-- insert into admins (user_id) select id from auth.users where email = 'YOUR_EMAIL_HERE';
