-- SchoolOS · calendari esterni da link iCal (Google Calendar, Outlook, registro...)
--
-- calendar_feeds: un link iCal (indirizzo segreto) per calendario collegato; max 3 per studente.
-- events.feed_id / external_id: gli eventi importati restano legati al loro calendario e si
-- aggiornano a ogni sincronizzazione senza duplicarsi; scollegare il calendario li elimina.

create table public.calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null default '' check (char_length(label) <= 60),
  -- Indirizzo segreto: chi lo conosce legge il calendario. Visibile solo al proprietario (RLS).
  url text not null check (url ~ '^https://' and char_length(url) <= 2000),
  last_synced_at timestamptz,
  last_error text check (char_length(last_error) <= 200),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create trigger calendar_feeds_row_cap before insert on public.calendar_feeds
  for each row execute function public.enforce_row_cap('3');

alter table public.calendar_feeds enable row level security;

create policy "calendar_feeds: solo i propri dati" on public.calendar_feeds
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.calendar_feeds to authenticated;
revoke all on public.calendar_feeds from anon;

alter table public.events
  add column feed_id uuid,
  add column external_id text check (char_length(external_id) <= 300),
  add constraint events_feed_fk foreign key (feed_id, user_id)
    references public.calendar_feeds (id, user_id) on delete cascade,
  add constraint events_feed_pair check ((feed_id is null) = (external_id is null));

create unique index events_feed_external on public.events (feed_id, external_id) where feed_id is not null;
