-- SchoolOS · notifiche lette e obiettivi di media
--
-- notification_reads: i promemoria sono calcolati (non salvati); qui si ricorda solo quali
-- l'utente ha già segnato come letti. L'id del promemoria include il tipo (es. "today-<task>"):
-- se un compito passa da "domani" a "oggi" torna non letto, come è giusto che sia.
-- goals: obiettivo di media per materia (subject_id valorizzato) o generale (subject_id nullo).

create table public.notification_reads (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reminder_id text not null check (char_length(reminder_id) between 1 and 120),
  read_at timestamptz not null default now(),
  primary key (user_id, reminder_id)
);

alter table public.notification_reads enable row level security;
create policy notification_reads_own on public.notification_reads
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.notification_reads to authenticated;

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  target numeric(5, 2) not null check (target > 0 and target <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);

-- Un solo obiettivo per materia e uno solo generale.
create unique index goals_one_per_subject on public.goals (user_id, subject_id) where subject_id is not null;
create unique index goals_one_general on public.goals (user_id) where subject_id is null;

create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

alter table public.goals enable row level security;
create policy goals_own on public.goals
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.goals to authenticated;
