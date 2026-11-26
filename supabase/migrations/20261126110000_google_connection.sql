-- SchoolOS · collegamento a Google (Gmail e Calendar)
--
-- google_connections: una riga per studente. Il codice di accesso a Google (refresh token) è
-- CIFRATO dal server con una chiave che non sta nel database (GOOGLE_TOKEN_KEY): chi legge il database
-- vede solo testo illeggibile. Scollegare elimina la riga e tutto ciò che è stato importato.
-- events.google_event_id / inbox_messages.external_id: legano le righe importate al loro originale,
-- così a ogni sincronizzazione non si duplicano.

create table public.google_connections (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  google_email text not null check (char_length(google_email) <= 254),
  refresh_token_enc text not null check (char_length(refresh_token_enc) <= 4000),
  scopes text not null default '' check (char_length(scopes) <= 1000),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_error text check (char_length(last_error) <= 200)
);

alter table public.google_connections enable row level security;

create policy "google_connections: solo i propri dati" on public.google_connections
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.google_connections to authenticated;
revoke all on public.google_connections from anon;

alter table public.events
  add column google_event_id text check (char_length(google_event_id) <= 300),
  add constraint events_one_origin check (google_event_id is null or feed_id is null);

create unique index events_google_event on public.events (user_id, google_event_id) where google_event_id is not null;

alter table public.inbox_messages
  add column external_id text check (char_length(external_id) <= 300);

create unique index inbox_messages_external on public.inbox_messages (user_id, external_id) where external_id is not null;
