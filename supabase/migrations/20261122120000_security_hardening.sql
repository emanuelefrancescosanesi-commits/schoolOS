-- SchoolOS · rafforzamento sicurezza (audit del 22 nov 2026)
--
-- 1. Le funzioni-trigger non devono essere richiamabili dall'API (PostgREST le espone se eseguibili).
-- 2. I codici dell'estensione scadono dopo 90 giorni senza uso (un codice dimenticato nel browser
--    di un computer di scuola non resta valido per sempre).
-- 3. Tetti per studente sul numero di righe: senza, un account potrebbe riempire il database.
-- 4. Il layout della dashboard (jsonb libero scritto dal client) ha una dimensione massima.

-- ─── 1. Funzioni-trigger non esposte ────────────────────────────────────────

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.enforce_grade_scale() from public, anon, authenticated;

-- ─── 2. Scadenza dei codici per inattività ──────────────────────────────────

create or replace function public.sync_grades(p_token text, p_rows jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tok public.extension_tokens%rowtype;
begin
  if p_token is null or p_token !~ '^sos_[0-9a-f]{64}$' then
    raise exception 'Codice non valido' using errcode = '28000';
  end if;
  select * into tok from public.extension_tokens
    where token_hash = sha256(convert_to(p_token, 'utf8'));
  -- Stesso messaggio per codice sbagliato e scaduto: non si distingue chi prova a indovinare.
  if not found or coalesce(tok.last_used_at, tok.created_at) < now() - interval '90 days' then
    raise exception 'Codice non valido' using errcode = '28000';
  end if;
  update public.extension_tokens set last_used_at = now() where id = tok.id;
  return public.sync_grades_for(tok.user_id, p_rows);
end;
$$;

revoke all on function public.sync_grades(text, jsonb) from public;
grant execute on function public.sync_grades(text, jsonb) to anon, authenticated;

-- ─── 3. Tetti per studente ──────────────────────────────────────────────────

-- Gira con i privilegi di chi scrive: la RLS limita già il conteggio alle sue righe.
create function public.enforce_row_cap() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cap integer := tg_argv[0]::integer;
  n integer;
begin
  execute format('select count(*) from %I.%I where user_id = $1', tg_table_schema, tg_table_name)
    into n using new.user_id;
  if n >= cap then
    raise exception 'Limite di % righe raggiunto per %', cap, tg_table_name using errcode = '53400';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_row_cap() from public, anon, authenticated;

create trigger grades_row_cap before insert on public.grades
  for each row execute function public.enforce_row_cap('10000');
create trigger assignments_row_cap before insert on public.assignments
  for each row execute function public.enforce_row_cap('5000');
create trigger subjects_row_cap before insert on public.subjects
  for each row execute function public.enforce_row_cap('100');
create trigger school_years_row_cap before insert on public.school_years
  for each row execute function public.enforce_row_cap('20');
create trigger periods_row_cap before insert on public.periods
  for each row execute function public.enforce_row_cap('60');

-- ─── 4. Dimensione del layout ───────────────────────────────────────────────

alter table public.profiles
  add constraint profiles_layout_size check (dashboard_layout is null or pg_column_size(dashboard_layout) <= 20000);
