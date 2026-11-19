-- sync_grades: il confronto dei nomi materia ignora maiuscole e differenze tra apostrofi
-- (’ ‘ ` ´ → '), perché il registro e lo studente possono scriverli in modo diverso.
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
        where s.user_id = tok.user_id and translate(lower(trim(s.name)), '’‘`´', '''''''''') = translate(lower(subj_name), '’‘`´', '''''''''')
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
