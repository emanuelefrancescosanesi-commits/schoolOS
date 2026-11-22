-- SchoolOS · le righe senza materia restavano orfane dopo l'eliminazione dell'account
--
-- `assignments` e `timetable_slots` collegano l'utente solo tramite la FK composita verso `subjects`,
-- che con subject_id nullo (MATCH SIMPLE) non viene verificata: un compito o una lezione senza materia
-- non spariva con delete_my_account(). Qui si aggiunge la FK diretta verso auth.users (on delete cascade),
-- dopo aver rimosso le righe già orfane.

delete from public.timetable_slots where user_id not in (select id from auth.users);
delete from public.assignments where user_id not in (select id from auth.users);

alter table public.timetable_slots
  add constraint timetable_slots_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
alter table public.assignments
  add constraint assignments_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade;
