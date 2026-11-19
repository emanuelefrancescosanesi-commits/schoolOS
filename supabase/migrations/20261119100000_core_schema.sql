-- SchoolOS · schema di base (Fase 3a)
--
-- Principi:
-- 1. Ogni riga appartiene a un solo studente (user_id) e la RLS ammette solo user_id = auth.uid().
-- 2. Le chiavi esterne sono composte (id, user_id): una FK non passa dalla RLS, quindi senza
--    questo vincolo uno studente potrebbe agganciare un proprio voto alla materia di un altro.
-- 3. I vincoli che dipendono dal profilo (scala dei voti) sono trigger; il resto sono CHECK.

create extension if not exists btree_gist with schema extensions;

-- ─── Tipi ───────────────────────────────────────────────────────────────────

create type public.period_scheme as enum ('trimestri', 'trimestre-pentamestre', 'quadrimestri');
create type public.average_method as enum ('arithmetic', 'weighted');
create type public.registro_provider as enum ('classeviva', 'argo', 'axios', 'altro', 'nessuno');
create type public.grade_kind as enum ('written', 'oral', 'practical');
create type public.assignment_kind as enum ('test', 'oral', 'homework', 'project');
create type public.assignment_status as enum ('todo', 'done');

-- ─── Utilità ────────────────────────────────────────────────────────────────

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Profili ────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '' check (char_length(first_name) <= 60),
  school_name text check (char_length(school_name) <= 120),
  class_name text check (char_length(class_name) <= 20),
  time_zone text not null default 'Europe/Rome' check (char_length(time_zone) <= 64),
  registro public.registro_provider not null default 'nessuno',
  period_scheme public.period_scheme,
  grade_min numeric(4, 2) not null default 1,
  grade_max numeric(4, 2) not null default 10,
  allow_half boolean not null default true,
  allow_plus_minus boolean not null default true,
  pass_threshold numeric(4, 2) not null default 6,
  average_method public.average_method not null default 'weighted',
  dashboard_layout jsonb check (dashboard_layout is null or jsonb_typeof(dashboard_layout) = 'object'),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_scale_range check (grade_min >= 0 and grade_max <= 10 and grade_min < grade_max),
  constraint profiles_pass_in_scale check (pass_threshold between grade_min and grade_max)
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Crea il profilo alla registrazione, con il nome passato in fase di sign-up o da Google.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, first_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
        nullif(split_part(trim(new.raw_user_meta_data ->> 'full_name'), ' ', 1), ''),
        ''
      ),
      60
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Anno scolastico e periodi ──────────────────────────────────────────────

create table public.school_years (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 20),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, starts_on),
  check (ends_on > starts_on and ends_on - starts_on <= 400)
);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  school_year_id uuid not null,
  name text not null check (char_length(name) between 1 and 40),
  position smallint not null check (position between 1 and 6),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (school_year_id, position),
  foreign key (school_year_id, user_id) references public.school_years (id, user_id) on delete cascade,
  check (ends_on > starts_on),
  -- Due periodi dello stesso anno non possono sovrapporsi.
  exclude using gist (school_year_id with =, daterange(starts_on, ends_on, '[]') with &&)
);

-- ─── Materie ────────────────────────────────────────────────────────────────

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  school_year_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 60),
  color smallint not null check (color between 1 and 8),
  teacher_name text check (char_length(teacher_name) <= 80),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (school_year_id, user_id) references public.school_years (id, user_id) on delete cascade
);

create unique index subjects_unique_name on public.subjects (school_year_id, lower(trim(name)));

create trigger subjects_updated_at before update on public.subjects
  for each row execute function public.set_updated_at();

-- ─── Voti ───────────────────────────────────────────────────────────────────

create table public.grades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  subject_id uuid not null,
  value numeric(4, 2) not null,
  weight numeric(4, 2) not null default 1 check (weight > 0 and weight <= 10),
  kind public.grade_kind not null default 'written',
  graded_on date not null,
  description text check (char_length(description) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  -- Solo interi, mezzi e quarti (+/− = ±0,25); la scala specifica la controlla il trigger.
  constraint grades_value_quarter check (value * 4 = trunc(value * 4) and value between 0 and 10)
);

create index grades_user_date on public.grades (user_id, graded_on desc);
create index grades_subject on public.grades (subject_id);

create trigger grades_updated_at before update on public.grades
  for each row execute function public.set_updated_at();

-- Il voto deve rispettare la scala scelta dallo studente nel profilo.
create function public.enforce_grade_scale() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p public.profiles%rowtype;
  fraction numeric;
begin
  select * into p from public.profiles where id = new.user_id;
  if not found then
    raise exception 'Profilo mancante per %', new.user_id using errcode = '23503';
  end if;

  if new.value < p.grade_min or new.value > p.grade_max then
    raise exception 'Voto % fuori scala (% – %)', new.value, p.grade_min, p.grade_max
      using errcode = '23514', constraint = 'grades_value_in_scale';
  end if;

  fraction := new.value - trunc(new.value);
  if (fraction = 0.5 and not p.allow_half)
     or (fraction in (0.25, 0.75) and not p.allow_plus_minus) then
    raise exception 'Voto % non ammesso dalla scala', new.value
      using errcode = '23514', constraint = 'grades_value_step';
  end if;

  return new;
end;
$$;

create trigger grades_enforce_scale before insert or update of value, user_id on public.grades
  for each row execute function public.enforce_grade_scale();

-- ─── Compiti, verifiche, interrogazioni ─────────────────────────────────────

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  subject_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 140),
  description text check (char_length(description) <= 2000),
  kind public.assignment_kind not null default 'homework',
  assigned_on date,
  due_on date not null,
  estimated_minutes integer check (estimated_minutes between 1 and 1440),
  status public.assignment_status not null default 'todo',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete cascade,
  check (assigned_on is null or due_on >= assigned_on),
  check ((status = 'done') = (completed_at is not null))
);

create index assignments_user_due on public.assignments (user_id, due_on) where status = 'todo';

create trigger assignments_updated_at before update on public.assignments
  for each row execute function public.set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.school_years enable row level security;
alter table public.periods enable row level security;
alter table public.subjects enable row level security;
alter table public.grades enable row level security;
alter table public.assignments enable row level security;

-- Il profilo nasce dal trigger e muore con l'account: il client può solo leggerlo e modificarlo.
create policy "profiles: lettura propria" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: modifica propria" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['school_years', 'periods', 'subjects', 'grades', 'assignments'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || ': solo i propri dati', t
    );
  end loop;
end;
$$;

-- Gli utenti non autenticati non toccano nessuna tabella.
revoke all on public.profiles, public.school_years, public.periods, public.subjects, public.grades, public.assignments
  from anon;

-- Le colonne di sistema del profilo non sono modificabili dal client.
revoke update on public.profiles from authenticated;
grant update (
  first_name, school_name, class_name, time_zone, registro, period_scheme,
  grade_min, grade_max, allow_half, allow_plus_minus, pass_threshold,
  average_method, dashboard_layout
) on public.profiles to authenticated;
