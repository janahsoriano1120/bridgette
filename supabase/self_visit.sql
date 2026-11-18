-- Lets a patient add their own visit to their Care Team.
drop policy if exists "patient adds own visit" on share_notes;
create policy "patient adds own visit" on share_notes for insert
  with check (auth.uid() = patient_id and status = 'accepted' and link_id = '00000000-0000-0000-0000-000000000000');
