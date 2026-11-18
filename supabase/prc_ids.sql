insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('prc-ids', 'prc-ids', false, 5242880, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "anon uploads prc id" on storage.objects;
create policy "anon uploads prc id" on storage.objects
for insert to anon with check (bucket_id = 'prc-ids');
