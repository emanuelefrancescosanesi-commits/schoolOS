-- SchoolOS · orario settimanale
--
-- Una riga = una lezione ricorrente (giorno della settimana + fascia oraria).
-- Stesse regole delle altre tabelle: RLS per utente, GRANT espliciti, materia dello stesso utente.

create table public.timetable_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  subject_id uuid,
  weekday smallint not null check (weekday between 1 and 6), -- 1 = lunedì ... 6 = sabato
  starts_at time not null,
  ends_at time not null,
  room text check (char_length(room) <= 40),
  created_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  check (ends_at > starts_at)
);

create index timetable_slots_user_day on public.timetable_slots (user_id, weekday, starts_at);

alter table public.timetable_slots enable row level security;

create policy "timetable_slots: solo i propri dati" on public.timetable_slots
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.timetable_slots to authenticated;
revoke all on public.timetable_slots from anon;
