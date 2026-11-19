-- SchoolOS · quota giornaliera per le funzioni AI
--
-- Ogni chiamata all'AI costa denaro: con un'app pubblica serve un tetto per utente, applicato
-- dal database (non dal client, né da una variabile in memoria che sparisce a ogni riavvio del
-- server). Il conteggio è per giorno italiano e per tipo di funzione.

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind ~ '^[a-z_]{1,40}$'),
  used integer not null default 0 check (used >= 0),
  primary key (user_id, day, kind)
);

-- Nessuna policy e nessun GRANT: il client non legge né scrive la tabella, passa dalla funzione.
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Consuma un'unità di quota. Restituisce true se c'era ancora margine, false se il tetto
-- giornaliero è raggiunto. L'incremento è atomico: due richieste parallele non lo superano.
create function public.consume_ai_quota(p_kind text, p_limit integer) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Europe/Rome')::date;
  new_used integer;
begin
  if uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'Limite non valido' using errcode = '22023';
  end if;

  insert into public.ai_usage as u (user_id, day, kind, used)
  values (uid, today, p_kind, 1)
  on conflict (user_id, day, kind) do update set used = u.used + 1
    where u.used < p_limit
  returning used into new_used;

  return new_used is not null;
end;
$$;

revoke all on function public.consume_ai_quota(text, integer) from public, anon;
grant execute on function public.consume_ai_quota(text, integer) to authenticated;
