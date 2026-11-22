-- SchoolOS · lista "Da fare" (stile Todoist, pensata per gli studenti)
--
-- Tabelle: todo_projects (liste), todo_labels (etichette), todos (attività e sotto-attività),
-- todo_label_links (attività ↔ etichette). Stessi principi dello schema di base:
-- ogni riga ha user_id, la RLS ammette solo user_id = auth.uid(), le FK sono composte (id, user_id)
-- così nessuno può agganciare una propria riga a una lista, materia o compito altrui.
--
-- "Inbox" = attività con project_id nullo. Le attività ricorrenti non si duplicano: al
-- completamento l'app sposta la scadenza all'occorrenza successiva (vedi lib/todo/recurrence.ts).

-- ─── Liste ──────────────────────────────────────────────────────────────────

create table public.todo_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  color smallint not null default 1 check (color between 1 and 8),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index todo_projects_unique_name on public.todo_projects (user_id, lower(trim(name)));

create trigger todo_projects_updated_at before update on public.todo_projects
  for each row execute function public.set_updated_at();

-- ─── Etichette ──────────────────────────────────────────────────────────────

create table public.todo_labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30 and name !~ '\s'),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index todo_labels_unique_name on public.todo_labels (user_id, lower(name));

-- La FK composita verso assignments richiede che (id, user_id) sia univoco anche lì.
alter table public.assignments add constraint assignments_id_user_key unique (id, user_id);

-- ─── Attività ───────────────────────────────────────────────────────────────

create table public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid,
  parent_id uuid,
  title text not null check (char_length(trim(title)) between 1 and 200),
  notes text check (char_length(notes) <= 4000),
  due_on date,
  due_time time,
  -- 1 = urgente … 4 = normale (come Todoist: p1 è la più alta).
  priority smallint not null default 4 check (priority between 1 and 4),
  -- {"freq": "day"|"week"|"month", "interval": 1..365, "weekdays": [1..7]} (1 = lunedì); solo con una scadenza.
  recurrence jsonb,
  subject_id uuid,
  assignment_id uuid,
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- Eliminare una lista non cancella le attività: tornano nell'Inbox.
  foreign key (project_id, user_id) references public.todo_projects (id, user_id) on delete set null (project_id),
  foreign key (parent_id, user_id) references public.todos (id, user_id) on delete cascade,
  -- Eliminare la materia o il compito collegato scollega soltanto.
  foreign key (subject_id, user_id) references public.subjects (id, user_id) on delete set null (subject_id),
  foreign key (assignment_id, user_id) references public.assignments (id, user_id) on delete set null (assignment_id),
  check (parent_id is null or parent_id <> id),
  check (due_time is null or due_on is not null),
  check (
    recurrence is null or (
      due_on is not null
      and jsonb_typeof(recurrence) = 'object'
      and recurrence ->> 'freq' in ('day', 'week', 'month')
      and (recurrence ->> 'interval') ~ '^[0-9]{1,3}$'
      and (recurrence ->> 'interval')::int between 1 and 365
      and (recurrence -> 'weekdays' is null or (
        jsonb_typeof(recurrence -> 'weekdays') = 'array'
        and jsonb_array_length(recurrence -> 'weekdays') between 1 and 7
      ))
    )
  )
);

create unique index todos_one_per_assignment on public.todos (user_id, assignment_id) where assignment_id is not null;
create index todos_user_open_due on public.todos (user_id, due_on) where completed_at is null;
create index todos_user_project on public.todos (user_id, project_id);
create index todos_parent on public.todos (parent_id) where parent_id is not null;
create index todos_user_completed on public.todos (user_id, completed_at desc) where completed_at is not null;

create trigger todos_updated_at before update on public.todos
  for each row execute function public.set_updated_at();

-- Sotto-attività: un solo livello, stessa lista del genitore, nessuna ricorrenza.
create function public.enforce_todo_shape() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent public.todos%rowtype;
begin
  if new.parent_id is not null then
    select * into parent from public.todos where id = new.parent_id and user_id = new.user_id;
    if not found then
      raise exception 'Attività padre non trovata' using errcode = '23503';
    end if;
    if parent.parent_id is not null then
      raise exception 'Le sotto-attività hanno un solo livello' using errcode = '23514', constraint = 'todos_single_level';
    end if;
    new.project_id := parent.project_id;
    new.recurrence := null;
  end if;
  return new;
end;
$$;

create trigger todos_enforce_shape before insert or update of parent_id, project_id, recurrence on public.todos
  for each row execute function public.enforce_todo_shape();

-- Quando il genitore cambia lista, le sotto-attività lo seguono.
create function public.todos_follow_parent() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.project_id is distinct from old.project_id then
    update public.todos set project_id = new.project_id where parent_id = new.id and user_id = new.user_id;
  end if;
  return null;
end;
$$;

create trigger todos_follow_parent after update of project_id on public.todos
  for each row when (new.parent_id is null) execute function public.todos_follow_parent();

-- ─── Etichette delle attività ───────────────────────────────────────────────

create table public.todo_label_links (
  todo_id uuid not null,
  label_id uuid not null,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (todo_id, label_id),
  foreign key (todo_id, user_id) references public.todos (id, user_id) on delete cascade,
  foreign key (label_id, user_id) references public.todo_labels (id, user_id) on delete cascade
);

create index todo_label_links_label on public.todo_label_links (label_id);

-- ─── Limiti per account (anti-abuso su un'app pubblica) ─────────────────────

create function public.enforce_todo_limits() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  max_rows integer := tg_argv[0]::integer;
  current_rows integer;
begin
  execute format('select count(*) from public.%I where user_id = $1', tg_table_name)
    into current_rows using new.user_id;
  if current_rows >= max_rows then
    raise exception 'Limite raggiunto (%) per %', max_rows, tg_table_name
      using errcode = '23514', constraint = tg_table_name || '_limit';
  end if;
  return new;
end;
$$;

create trigger todos_limit before insert on public.todos
  for each row execute function public.enforce_todo_limits(5000);
create trigger todo_projects_limit before insert on public.todo_projects
  for each row execute function public.enforce_todo_limits(60);
create trigger todo_labels_limit before insert on public.todo_labels
  for each row execute function public.enforce_todo_limits(100);

-- ─── Row Level Security e privilegi ─────────────────────────────────────────

alter table public.todo_projects enable row level security;
alter table public.todo_labels enable row level security;
alter table public.todos enable row level security;
alter table public.todo_label_links enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['todo_projects', 'todo_labels', 'todos', 'todo_label_links'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || ': solo i propri dati', t
    );
  end loop;
end;
$$;

grant select, insert, update, delete
  on public.todo_projects, public.todo_labels, public.todos, public.todo_label_links
  to authenticated;
revoke all on public.todo_projects, public.todo_labels, public.todos, public.todo_label_links from anon;

-- Le funzioni-trigger non sono richiamabili dall'API (come in 20261122120000_security_hardening).
revoke all on function public.enforce_todo_shape() from public, anon, authenticated;
revoke all on function public.todos_follow_parent() from public, anon, authenticated;
revoke all on function public.enforce_todo_limits() from public, anon, authenticated;
