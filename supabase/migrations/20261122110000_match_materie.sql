-- Abbinamento robusto delle materie nella sincronizzazione automatica.
-- Prima il confronto era "stesso testo, ignorando maiuscole e apostrofi": «Storia dell'arte» dal
-- registro non trovava «Disegno e storia dell'arte» in SchoolOS e la sync creava una materia doppia.
-- Ora lo stesso criterio dell'anteprima import (lib/import/normalize.ts) gira nel database:
-- 1) stessa chiave (accenti, apostrofi, ordine, sinonimi come «Ed. fisica» = «Scienze motorie»);
-- 2) abbreviazione univoca; 3) un nome contenuto nell'altro (almeno due termini).
-- Niente somiglianza «fuzzy» qui: nessuno conferma la riga, quindi nel dubbio la materia resta
-- «non trovata» (o viene creata) invece di finire nella materia sbagliata.

create or replace function public.subject_tokens(p_name text) returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
  allt text[];
  sig text[];
begin
  s := translate(lower(coalesce(p_name, '')), 'àáâãäåèéêëìíîïòóôõöùúûüçñ', 'aaaaaaeeeeiiiiooooouuuucn');
  s := btrim(regexp_replace(s, '[^a-z0-9]+', ' ', 'g'));
  s := regexp_replace(s, '\y(?:ed|educ|educazione) fisica\y', 'scienze motorie', 'g');
  s := regexp_replace(s, '\y(?:ed|educ) (civica|artistica|tecnica|musicale)\y', 'educazione \1', 'g');
  s := regexp_replace(s, '\yeducazione alla cittadinanza\y', 'educazione civica', 'g');
  s := regexp_replace(s, '\y(?:insegnamento religione cattolica|insegnamento della religione cattolica|religione cattolica|irc|ire|relig)\y', 'religione', 'g');

  select coalesce(array_agg(case w
      when 'italiana' then 'italiano' when 'tedesca' then 'tedesco' when 'spagnola' then 'spagnolo'
      when 'latina' then 'latino' when 'greca' then 'greco' else w end order by ord), '{}')
    into allt
    from regexp_split_to_table(s, ' ') with ordinality as t(w, ord)
    where w <> '' and w <> all (array['e','ed','di','del','dell','della','dello','dei','degli','delle','il','la','lo','l','le','a','al','all',
                                     'alla','in','nel','nell','nella','per','con','su','sul','sull','da','dal','dalla']);
  select coalesce(array_agg(w order by ord), '{}')
    into sig
    from unnest(allt) with ordinality as t(w, ord)
    where w <> all (array['lingua','letteratura','cultura','straniera','straniere','sportive','sportiva','sport']);
  if cardinality(sig) = 0 then return allt; end if;
  return sig;
end;
$$;

create or replace function public.subject_key(p_name text) returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_to_string(array(select u from unnest(public.subject_tokens(p_name)) u order by u), ' '), '');
$$;

-- Restituisce la materia dell'utente che corrisponde al nome del registro, o null.
create or replace function public.match_subject(p_user uuid, p_name text) returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  qt text[] := public.subject_tokens(p_name);
  qk text;
  hit uuid;
  yr uuid;
  n int;
begin
  if cardinality(qt) = 0 then return null; end if;
  qk := public.subject_key(p_name);

  -- 1) Stessa chiave, in qualunque anno scolastico (il più recente per primo).
  select s.id into hit
    from public.subjects s
    join public.school_years y on y.id = s.school_year_id
    where s.user_id = p_user and public.subject_key(s.name) = qk
    order by y.starts_on desc, s.position
    limit 1;
  if hit is not null then return hit; end if;

  -- I livelli successivi guardano solo l'anno più recente, dove la stessa materia non compare due volte.
  select y.id into yr from public.school_years y where y.user_id = p_user order by y.starts_on desc limit 1;
  if yr is null then return null; end if;

  -- 2) Abbreviazione: ogni termine è prefisso di un termine della materia, e almeno uno strettamente.
  if char_length(array_to_string(qt, '')) >= 3 then
    select count(*), min(s.id::text)::uuid into n, hit
      from public.subjects s
      where s.school_year_id = yr
        and not exists (select 1 from unnest(qt) q where not exists (
              select 1 from unnest(public.subject_tokens(s.name)) u where left(u, char_length(q)) = q))
        and exists (select 1 from unnest(qt) q where exists (
              select 1 from unnest(public.subject_tokens(s.name)) u where char_length(u) > char_length(q) and left(u, char_length(q)) = q));
    if n = 1 then return hit; end if;
    if n > 1 then return null; end if;
  end if;

  -- 3) Un nome contiene l'altro, con almeno due termini sul lato più corto.
  select count(*), min(s.id::text)::uuid into n, hit
    from public.subjects s
    where s.school_year_id = yr
      and (
        (cardinality(qt) >= 2 and qt <@ public.subject_tokens(s.name))
        or (cardinality(public.subject_tokens(s.name)) >= 2 and public.subject_tokens(s.name) <@ qt)
      );
  if n = 1 then return hit; end if;
  return null;
end;
$$;

revoke all on function public.subject_tokens(text), public.subject_key(text) from public;
revoke all on function public.match_subject(uuid, text) from public, anon, authenticated;

create or replace function public.sync_grades_for(p_user uuid, p_rows jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r jsonb;
  subj uuid;
  v numeric;
  k public.grade_kind;
  d date;
  w numeric;
  updated int := 0;
  inserted int := 0;
  skipped int := 0;
  invalid int := 0;
  unmatched text[] := '{}';
  subj_name text;
  yr uuid;
  nsub int;
  created text[] := '{}';
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 300 then
    raise exception 'Dati non validi' using errcode = '22023';
  end if;

  -- Anno scolastico più recente: lì vanno le materie nuove.
  select y.id into yr from public.school_years y where y.user_id = p_user order by y.starts_on desc limit 1;

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      subj_name := trim(r ->> 'subject');
      v := (r ->> 'value')::numeric;
      d := (r ->> 'date')::date;
      k := coalesce(nullif(r ->> 'kind', ''), 'written')::public.grade_kind;
      -- Peso letto dal registro (facoltativo): valido solo tra 0 e 10, altrimenti si ignora.
      w := null;
      if (r ->> 'weight') ~ '^[0-9]+(\.[0-9]+)?$' and (r ->> 'weight')::numeric > 0 and (r ->> 'weight')::numeric <= 10 then
        w := round((r ->> 'weight')::numeric, 2);
      end if;

      subj := public.match_subject(p_user, subj_name);
      if subj is null and yr is not null and subj_name is not null
         and char_length(subj_name) between 1 and 60 then
        -- Materia del registro che SchoolOS non ha ancora: la crea con lo stesso nome
        -- (tetto di 25 materie per anno, contro abusi del codice).
        select count(*) into nsub from public.subjects s where s.school_year_id = yr;
        if nsub < 25 then
          insert into public.subjects (user_id, school_year_id, name, color, position)
          values (p_user, yr, subj_name, (nsub % 8) + 1, nsub)
          on conflict do nothing
          returning id into subj;
          if subj is not null then created := created || subj_name; end if;
        end if;
      end if;
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
        where g.user_id = p_user and g.subject_id = subj
          and g.graded_on = d and g.value = v and g.kind = k
      ) then
        -- Voto già presente: se il registro indica un peso diverso lo si allinea (corregge i voti
        -- importati prima che il peso venisse letto).
        if w is not null then
          update public.grades g set weight = w
          where g.user_id = p_user and g.subject_id = subj
            and g.graded_on = d and g.value = v and g.kind = k and g.weight <> w;
          if found then updated := updated + 1; end if;
        end if;
        skipped := skipped + 1;
        continue;
      end if;

      insert into public.grades (user_id, subject_id, value, kind, graded_on, weight)
      values (p_user, subj, v, k, d, coalesce(w, 1));
      inserted := inserted + 1;
    exception when others then
      invalid := invalid + 1;
    end;
  end loop;

  return jsonb_build_object('inserted', inserted, 'skipped', skipped, 'invalid', invalid, 'unmatched', to_jsonb(unmatched), 'created', to_jsonb(created), 'updated', updated);
end;
$$;

revoke all on function public.sync_grades_for(uuid, jsonb) from public, anon, authenticated;

