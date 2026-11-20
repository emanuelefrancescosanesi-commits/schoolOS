-- sync_grades: legge il peso del voto dal registro (campo facoltativo "weight") e, per i voti già
-- presenti, aggiorna il peso se diverso (senza duplicare). Risposta con 'updated'.
-- sync_grades: le materie del registro che SchoolOS non conosce vengono create al volo
-- (stesso nome, anno scolastico più recente, massimo 25 per anno). Prima restavano «non trovate»
-- e lo studente doveva allineare i nomi a mano. Il confronto resta insensibile a maiuscole e apostrofi.
create or replace function public.sync_grades(p_token text, p_rows jsonb) returns jsonb
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

  -- Anno scolastico più recente: lì vanno le materie nuove.
  select y.id into yr from public.school_years y where y.user_id = tok.user_id order by y.starts_on desc limit 1;

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

      select s.id into subj
        from public.subjects s
        join public.school_years y on y.id = s.school_year_id
        where s.user_id = tok.user_id and translate(lower(trim(s.name)), '’‘`´', '''''''''') = translate(lower(subj_name), '’‘`´', '''''''''')
        order by y.starts_on desc limit 1;
      if subj is null and yr is not null and subj_name is not null
         and char_length(subj_name) between 1 and 60 then
        -- Materia del registro che SchoolOS non ha ancora: la crea con lo stesso nome
        -- (tetto di 25 materie per anno, contro abusi del codice).
        select count(*) into nsub from public.subjects s where s.school_year_id = yr;
        if nsub < 25 then
          insert into public.subjects (user_id, school_year_id, name, color, position)
          values (tok.user_id, yr, subj_name, (nsub % 8) + 1, nsub)
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
        where g.user_id = tok.user_id and g.subject_id = subj
          and g.graded_on = d and g.value = v and g.kind = k
      ) then
        -- Voto già presente: se il registro indica un peso diverso lo si allinea (corregge i voti
        -- importati prima che il peso venisse letto).
        if w is not null then
          update public.grades g set weight = w
          where g.user_id = tok.user_id and g.subject_id = subj
            and g.graded_on = d and g.value = v and g.kind = k and g.weight <> w;
          if found then updated := updated + 1; end if;
        end if;
        skipped := skipped + 1;
        continue;
      end if;

      insert into public.grades (user_id, subject_id, value, kind, graded_on, weight)
      values (tok.user_id, subj, v, k, d, coalesce(w, 1));
      inserted := inserted + 1;
    exception when others then
      invalid := invalid + 1;
    end;
  end loop;

  return jsonb_build_object('inserted', inserted, 'skipped', skipped, 'invalid', invalid, 'unmatched', to_jsonb(unmatched), 'created', to_jsonb(created), 'updated', updated);
end;
$$;

revoke all on function public.sync_grades(text, jsonb) from public;
grant execute on function public.sync_grades(text, jsonb) to anon, authenticated;
