-- SchoolOS · Impostazioni e profilo
--
-- 1. Preferenze di notifica nel profilo (modificabili dal client, come il resto del profilo).
-- 2. replace_periods: sostituisce in modo atomico i periodi dell'anno corrente e (se serve)
--    ne corregge le date. I voti non hanno un periodo: si assegnano per data, quindi rifare i
--    periodi non tocca nessun voto. È SECURITY INVOKER: la RLS resta quella di sempre.

alter table public.profiles
  add column notify_overdue boolean not null default true,
  add column notify_due_soon boolean not null default true,
  add column notify_tests boolean not null default true,
  add column notify_test_days smallint not null default 3 check (notify_test_days between 1 and 14);

grant update (notify_overdue, notify_due_soon, notify_tests, notify_test_days) on public.profiles to authenticated;

create function public.replace_periods(p_year_id uuid, p_scheme public.period_scheme, p_year jsonb, p_periods jsonb) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  year_id uuid;
  year_start date := (p_year ->> 'starts_on')::date;
  year_end date := (p_year ->> 'ends_on')::date;
  item jsonb;
  pos smallint := 0;
begin
  if uid is null then
    raise exception 'Accesso richiesto' using errcode = '42501';
  end if;
  if jsonb_typeof(p_periods) is distinct from 'array' or jsonb_array_length(p_periods) not between 1 and 6 then
    raise exception 'Servono da 1 a 6 periodi' using errcode = '22023';
  end if;
  if year_end <= year_start then
    raise exception 'L''anno deve finire dopo l''inizio' using errcode = '22023';
  end if;

  -- L'anno lo sceglie il chiamante (quello in corso); qui si verifica solo che sia suo, e lo si blocca.
  select id into year_id from public.school_years where id = p_year_id and user_id = uid for update;
  if year_id is null then
    raise exception 'Anno scolastico non trovato' using errcode = 'P0002';
  end if;

  -- Prima si tolgono i vecchi periodi, così il vincolo anti-sovrapposizione non scatta sul nuovo anno.
  delete from public.periods where school_year_id = year_id and user_id = uid;

  update public.school_years set
    label = coalesce(nullif(trim(p_year ->> 'label'), ''), label),
    starts_on = year_start,
    ends_on = year_end
  where id = year_id and user_id = uid;

  for item in select * from jsonb_array_elements(p_periods) loop
    pos := pos + 1;
    if (item ->> 'starts_on')::date < year_start or (item ->> 'ends_on')::date > year_end then
      raise exception 'Il periodo "%" esce dall''anno scolastico', item ->> 'name' using errcode = '22023';
    end if;
    insert into public.periods (user_id, school_year_id, name, position, starts_on, ends_on)
    values (uid, year_id, item ->> 'name', pos, (item ->> 'starts_on')::date, (item ->> 'ends_on')::date);
  end loop;

  update public.profiles set period_scheme = p_scheme where id = uid;
  return year_id;
end;
$$;

revoke all on function public.replace_periods(uuid, public.period_scheme, jsonb, jsonb) from public, anon;
grant execute on function public.replace_periods(uuid, public.period_scheme, jsonb, jsonb) to authenticated;
