alter table waitlist add column if not exists prc text;
alter table waitlist add column if not exists sub_specialty text;
alter table waitlist add column if not exists clinic text;
alter table waitlist add column if not exists additional_clinics text;
alter table waitlist add column if not exists offers_telemedicine boolean;
