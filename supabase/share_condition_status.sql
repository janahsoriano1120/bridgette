-- Doctor picks which condition a note is about, and its status. Run once in the Supabase SQL editor.
alter table share_notes add column if not exists condition_status text;

drop function if exists submit_share_note(text, text, text, text, text, text, text, text, text, text, jsonb, jsonb);

create or replace function submit_share_note(p_token text, p_name text, p_profession text, p_prc text, p_title text, p_note text, p_diagnosis text default null, p_specialty text default null, p_credentials text default null, p_subspecialty text default null, p_meds jsonb default '[]'::jsonb, p_attachments jsonb default '[]'::jsonb, p_condition_status text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l record; v_prc text; v_name text;
begin
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_profession),'') = '' or coalesce(trim(p_note),'') = '' then
    return jsonb_build_object('error','missing');
  end if;
  v_prc := nullif(trim(coalesce(p_prc,'')),'');
  if v_prc is null and trim(p_profession) in ('Physician','Nurse','Pharmacist','Nutritionist-Dietitian','Physical therapist','Psychologist') then
    return jsonb_build_object('error','prc');
  end if;
  v_name := share_base_name(p_name, p_profession, v_prc);
  select * into l from share_links where token::text = p_token limit 1;
  if not found then return jsonb_build_object('error','not_found'); end if;
  if l.is_active is distinct from true then return jsonb_build_object('error','revoked'); end if;
  if l.expires_at is not null and l.expires_at < now() then return jsonb_build_object('error','expired'); end if;

  if jsonb_typeof(coalesce(p_meds,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_meds,'[]'::jsonb)) > 20 or length(coalesce(p_meds,'[]'::jsonb)::text) > 12000 then
    return jsonb_build_object('error','meds');
  end if;
  if jsonb_typeof(coalesce(p_attachments,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_attachments,'[]'::jsonb)) > 6
     or exists (select 1 from jsonb_array_elements(coalesce(p_attachments,'[]'::jsonb)) a where coalesce(a->>'path','') not like l.id::text || '/%' or coalesce(trim(a->>'name'),'') = '') then
    return jsonb_build_object('error','attachment');
  end if;

  insert into share_notes(link_id, patient_id, provider_name, provider_profession, provider_prc, provider_specialty, provider_subspecialty, provider_credentials, title, note, diagnosis, condition_status, meds, attachments)
  values (l.id, l.patient_id, v_name, trim(p_profession), v_prc, nullif(trim(coalesce(p_specialty,'')),''), nullif(trim(coalesce(p_subspecialty,'')),''), share_clean_creds(p_credentials),
          nullif(trim(coalesce(p_title,'')),''), trim(p_note),
          case when v_prc is not null then nullif(trim(coalesce(p_diagnosis,'')),'') else null end,
          case when v_prc is not null and trim(coalesce(p_condition_status,'')) in ('Managing','Improving','Stable','Worsening','Resolved') then trim(p_condition_status) else null end,
          coalesce(p_meds,'[]'::jsonb), coalesce(p_attachments,'[]'::jsonb));
  return jsonb_build_object('ok', true);
end $$;

grant execute on function submit_share_note(text, text, text, text, text, text, text, text, text, text, jsonb, jsonb, text) to anon, authenticated;
