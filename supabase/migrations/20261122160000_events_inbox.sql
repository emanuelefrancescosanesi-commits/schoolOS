-- SchoolOS · calendario (eventi, verifiche, interrogazioni) e Inbox (comunicazioni)
--
-- events: impegni inseriti dallo studente (verifica, interrogazione, progetto, compito, evento generico).
-- inbox_messages: comunicazioni della scuola incollate a mano (in futuro anche da email/registro).
-- Stesse regole delle altre tabelle: RLS per utente, GRANT espliciti, materia dello stesso utente,
-- tetto di righe per studente, cancellazione a cascata con l'account.

-- ─── Eventi ─────────────────────────────────────────────────────────────────

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 140),
  kind text not null default 'event' check (kind in ('test', 'oral', 'project', 'homework', 'event')),
  starts_on date not null,
  starts_at time, -- null = tutto il giorno
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);

create index events_user_day on public.events (user_id, starts_on, starts_at);

create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger events_row_cap before insert on public.events
  for each row execute function public.enforce_row_cap('3000');

alter table public.events enable row level security;

create policy "events: solo i propri dati" on public.events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.events to authenticated;
revoke all on public.events from anon;

-- ─── Comunicazioni ──────────────────────────────────────────────────────────

create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_id uuid,
  source text not null default 'manual' check (source in ('manual', 'email', 'registro', 'calendar')),
  sender text not null default '' check (char_length(sender) <= 120),
  title text not null check (char_length(trim(title)) between 1 and 200),
  body text not null default '' check (char_length(body) <= 4000),
  received_at timestamptz not null default now(),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade
);

create index inbox_messages_user_date on public.inbox_messages (user_id, received_at desc);

create trigger inbox_messages_row_cap before insert on public.inbox_messages
  for each row execute function public.enforce_row_cap('2000');

alter table public.inbox_messages enable row level security;

create policy "inbox_messages: solo i propri dati" on public.inbox_messages
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.inbox_messages to authenticated;
revoke all on public.inbox_messages from anon;
