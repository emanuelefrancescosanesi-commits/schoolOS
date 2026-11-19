-- SchoolOS · onboarding atomico
--
-- L'onboarding scrive profilo, anno, periodi e materie in un colpo solo: o tutto o niente.
-- È SECURITY DEFINER perché deve impostare onboarding_completed_at, che il client non può
-- modificare; per questo ogni scrittura usa esplicitamente auth.uid() e mai un id passato
-- dal chiamante. La validazione completa è nel server (Zod); qui restano i controlli che
-- proteggono l'integrità anche se qualcuno chiama la funzione direttamente.

create function public.complete_onboarding(payload jsonb) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  prof jsonb := payload -> 'profile';
  yr jsonb := payload -> 'school_year';
  year_id uuid;
  year_start date;
  year_end date;
  item jsonb;
  pos smallint := 0;
begin
  if uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = uid and onboarding_completed_at is null for update;
  if not found then
    raise exception 'Onboarding già completato' using errcode = 'P0001';
  end if;

  if jsonb_array_length(coalesce(payload -> 'periods', '[]')) not between 1 and 6 then
    raise exception 'Servono da 1 a 6 periodi' using errcode = '22023';
  end if;
  if jsonb_array_length(coalesce(payload -> 'subjects', '[]')) not between 1 and 30 then
    raise exception 'Servono da 1 a 30 materie' using errcode = '22023';
  end if;

  update public.profiles set
    first_name = prof ->> 'first_name',
    school_name = nullif(prof ->> 'school_name', ''),
    class_name = nullif(prof ->> 'class_name', ''),
    registro = (prof ->> 'registro')::public.registro_provider,
    period_scheme = (prof ->> 'period_scheme')::public.period_scheme,
    grade_min = (prof ->> 'grade_min')::numeric,
    grade_max = (prof ->> 'grade_max')::numeric,
    allow_half = (prof ->> 'allow_half')::boolean,
    allow_plus_minus = (prof ->> 'allow_plus_minus')::boolean,
    pass_threshold = (prof ->> 'pass_threshold')::numeric,
    average_method = (prof ->> 'average_method')::public.average_method,
    onboarding_completed_at = now()
  where id = uid;

  year_start := (yr ->> 'starts_on')::date;
  year_end := (yr ->> 'ends_on')::date;

  insert into public.school_years (user_id, label, starts_on, ends_on)
  values (uid, yr ->> 'label', year_start, year_end)
  returning id into year_id;

  for item in select * from jsonb_array_elements(payload -> 'periods') loop
    pos := pos + 1;
    if (item ->> 'starts_on')::date < year_start or (item ->> 'ends_on')::date > year_end then
      raise exception 'Il periodo "%" esce dall''anno scolastico', item ->> 'name' using errcode = '22023';
    end if;
    insert into public.periods (user_id, school_year_id, name, position, starts_on, ends_on)
    values (uid, year_id, item ->> 'name', pos, (item ->> 'starts_on')::date, (item ->> 'ends_on')::date);
  end loop;

  pos := 0;
  for item in select * from jsonb_array_elements(payload -> 'subjects') loop
    pos := pos + 1;
    insert into public.subjects (user_id, school_year_id, name, color, teacher_name, position)
    values (uid, year_id, trim(item ->> 'name'), (item ->> 'color')::smallint, nullif(trim(item ->> 'teacher_name'), ''), pos);
  end loop;

  return year_id;
end;
$$;

revoke all on function public.complete_onboarding(jsonb) from public, anon;
grant execute on function public.complete_onboarding(jsonb) to authenticated;
