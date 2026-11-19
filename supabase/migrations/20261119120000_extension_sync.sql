-- SchoolOS · collegamento dell'estensione del browser al tuo account
--
-- L'estensione non vede mai la password: lo studente genera un «codice di collegamento»
-- (revocabile) e l'estensione lo usa solo per mandare voti. Nel database resta solo l'hash
-- SHA-256 del codice; il codice in chiaro si vede una volta sola, alla creazione.

create table public.extension_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null default 'Estensione browser' check (char_length(label) between 1 and 60),
  token_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index extension_tokens_user on public.extension_tokens (user_id);

alter table public.extension_tokens enable row level security;
create policy "extension_tokens: lettura propria" on public.extension_tokens
  for select to authenticated using (user_id = (select auth.uid()));
create policy "extension_tokens: revoca propria" on public.extension_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- Il client può vedere e revocare i propri codici, non crearli né leggerne l'hash a mano:
-- la creazione passa dalla funzione qui sotto.
revoke all on public.extension_tokens from anon, authenticated;
grant select (id, label, created_at, last_used_at), delete on public.extension_tokens to authenticated;

-- Crea un codice e lo restituisce in chiaro (solo ora). Massimo 5 codici attivi per utente.
create function public.create_extension_token(p_label text default 'Estensione browser') returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  token text;
begin
  if uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;
  if (select count(*) from public.extension_tokens where user_id = uid) >= 5 then
    raise exception 'Troppi codici attivi: revocane uno' using errcode = '53400';
  end if;
  token := 'sos_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.extension_tokens (user_id, label, token_hash)
  values (uid, left(coalesce(nullif(trim(p_label), ''), 'Estensione browser'), 60),
          sha256(convert_to(token, 'utf8')));
  return token;
end;
$$;

revoke all on function public.create_extension_token(text) from public, anon;
grant execute on function public.create_extension_token(text) to authenticated;

-- Riceve i voti dall'estensione. Si autentica con il codice (non con la sessione), quindi è
-- eseguibile da anon: tutto il controllo sta qui dentro.
--  · solo voti di materie che lo studente ha già (nome uguale, senza maiuscole);
--  · salta i duplicati (stessa materia, data, voto e tipo);
--  · i voti non validi per la sua scala vengono contati e ignorati, senza bloccare gli altri.
-- Restituisce {inserted, skipped, invalid, unmatched: [nomi materia]}.
create function public.sync_grades(p_token text, p_rows jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok public.extension_tokens%rowtype;
  r jsonb;
  subj uuid;
  v numeric;
  k public.grade_kind;
  d date;
  inserted int := 0;
  skipped int := 0;
  invalid int := 0;
  unmatched text[] := '{}';
  subj_name text;
begin
  if p_token is null or p_token !~ '^sos_[0-9a-f]{64}$' then
    raise exception 'Codice non valido' using errcode = '28000';
  end if;
  select * into tok from public.extension_tokens
    where token_hash = sha256(convert_to(p_token, 'utf8'));
  if not found then
    raise exception 'Codice non valido' using errcode = '28000';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 300 then
    raise exception 'Dati non validi' using errcode = '22023';
  end if;

  update public.extension_tokens set last_used_at = now() where id = tok.id;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      subj_name := trim(r ->> 'subject');
      v := (r ->> 'value')::numeric;
      d := (r ->> 'date')::date;
      k := coalesce(nullif(r ->> 'kind', ''), 'written')::public.grade_kind;

      select s.id into subj
        from public.subjects s
        join public.school_years y on y.id = s.school_year_id
        where s.user_id = tok.user_id and lower(trim(s.name)) = lower(subj_name)
        order by y.starts_on desc limit 1;
      if subj is null then
        if subj_name is not null and not (subj_name = any (unmatched)) and cardinality(unmatched) < 20 then
          unmatched := unmatched || subj_name;
        end if;
        continue;
      end if;

      if d > current_date then
        invalid := invalid + 1;
        continue;
      end if;
      if exists (
        select 1 from public.grades g
        where g.user_id = tok.user_id and g.subject_id = subj
          and g.graded_on = d and g.value = v and g.kind = k
      ) then
        skipped := skipped + 1;
        continue;
      end if;

      insert into public.grades (user_id, subject_id, value, kind, graded_on)
      values (tok.user_id, subj, v, k, d);
      inserted := inserted + 1;
    exception when others then
      invalid := invalid + 1;
    end;
  end loop;

  return jsonb_build_object('inserted', inserted, 'skipped', skipped, 'invalid', invalid, 'unmatched', to_jsonb(unmatched));
end;
$$;

revoke all on function public.sync_grades(text, jsonb) from public;
grant execute on function public.sync_grades(text, jsonb) to anon, authenticated;
