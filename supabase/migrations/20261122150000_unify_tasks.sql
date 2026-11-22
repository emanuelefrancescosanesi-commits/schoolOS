-- SchoolOS · «Compiti» e «Da fare» come un'unica fonte
--
-- Prima: `assignments` (Compiti, Dashboard, Notifiche) e `todos` (Da fare) erano due liste
-- separate, collegate solo da un'importazione manuale.
-- Ora: ogni compito ha SEMPRE un'attività «Da fare» collegata (todos.assignment_id) e le due righe
-- restano allineate da trigger nel database, quindi la sincronizzazione vale per qualunque
-- scrittura (app, estensione, SQL) ed è atomica:
--   · nuovo compito            → nuova attività (priorità dal tipo);
--   · compito modificato/spuntato → attività aggiornata (titolo, scadenza, materia, completamento);
--   · attività collegata modificata/spuntata → compito aggiornato;
--   · compito eliminato        → attività eliminata; attività collegata eliminata → compito eliminato.
-- Anti-ricorsione: durante la propagazione il flag di transazione app.task_sync vale '1' e i trigger
-- dell'altro lato non fanno nulla (funziona anche per le eliminazioni a cascata, es. materia eliminata).
-- Le attività ricorrenti non chiudono il compito: scorre solo la scadenza.


-- ─── compito → attività ─────────────────────────────────────────────────────

create function public.assignment_to_todo() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.task_sync', true), '') = '1' then
    return null;
  end if;
  perform set_config('app.task_sync', '1', true);

  if tg_op = 'INSERT' then
    begin
      insert into public.todos (user_id, title, notes, due_on, priority, subject_id, assignment_id, completed_at)
      values (
        new.user_id, new.title, new.description, new.due_on,
        case new.kind when 'test' then 1 when 'oral' then 1 when 'project' then 2 else 3 end,
        new.subject_id, new.id, new.completed_at
      )
      on conflict (user_id, assignment_id) where assignment_id is not null do nothing;
    exception when check_violation then
      -- Limite di attività raggiunto: il compito si salva lo stesso (resta visibile in «Compiti»).
      null;
    end;
  else
    update public.todos
       set title = new.title,
           notes = coalesce(new.description, notes),
           due_on = new.due_on,
           subject_id = new.subject_id,
           -- Una ricorrente resta aperta: scorre la scadenza, non si chiude.
           completed_at = case when recurrence is not null and new.completed_at is not null then completed_at else new.completed_at end
     where assignment_id = new.id and user_id = new.user_id
       and (title, due_on, subject_id, completed_at) is distinct from (new.title, new.due_on, new.subject_id, new.completed_at);
  end if;
  perform set_config('app.task_sync', '', true);
  return null;
end;
$$;

create trigger assignments_sync_todo after insert or update of title, description, due_on, subject_id, completed_at on public.assignments
  for each row execute function public.assignment_to_todo();

create function public.assignment_deleted() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('app.task_sync', true), '') = '1' then
    return null;
  end if;
  perform set_config('app.task_sync', '1', true);
  delete from public.todos where assignment_id = old.id and user_id = old.user_id;
  perform set_config('app.task_sync', '', true);
  return null;
end;
$$;

create trigger assignments_delete_todo after delete on public.assignments
  for each row execute function public.assignment_deleted();

-- ─── attività → compito ─────────────────────────────────────────────────────

create function public.todo_to_assignment() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignment_id is null or coalesce(current_setting('app.task_sync', true), '') = '1' then
    return null;
  end if;
  perform set_config('app.task_sync', '1', true);
  update public.assignments a
     set title = left(trim(new.title), 140),
         due_on = coalesce(new.due_on, a.due_on),
         subject_id = new.subject_id,
         status = case when new.completed_at is null then 'todo'::public.assignment_status else 'done'::public.assignment_status end,
         completed_at = new.completed_at
   where a.id = new.assignment_id and a.user_id = new.user_id
     and (a.title, a.due_on, a.subject_id, a.completed_at)
         is distinct from (left(trim(new.title), 140), coalesce(new.due_on, a.due_on), new.subject_id, new.completed_at);
  perform set_config('app.task_sync', '', true);
  return null;
end;
$$;

create trigger todos_sync_assignment after update of title, due_on, subject_id, completed_at on public.todos
  for each row execute function public.todo_to_assignment();

create function public.todo_deleted() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.assignment_id is null or coalesce(current_setting('app.task_sync', true), '') = '1' then
    return null;
  end if;
  perform set_config('app.task_sync', '1', true);
  delete from public.assignments where id = old.assignment_id and user_id = old.user_id;
  perform set_config('app.task_sync', '', true);
  return null;
end;
$$;

create trigger todos_delete_assignment after delete on public.todos
  for each row execute function public.todo_deleted();

revoke all on function public.assignment_to_todo() from public, anon, authenticated;
revoke all on function public.assignment_deleted() from public, anon, authenticated;
revoke all on function public.todo_to_assignment() from public, anon, authenticated;
revoke all on function public.todo_deleted() from public, anon, authenticated;

-- ─── Compiti già esistenti senza attività collegata ─────────────────────────

insert into public.todos (user_id, title, notes, due_on, priority, subject_id, assignment_id, completed_at)
select a.user_id, a.title, a.description, a.due_on,
       case a.kind when 'test' then 1 when 'oral' then 1 when 'project' then 2 else 3 end,
       a.subject_id, a.id, a.completed_at
  from public.assignments a
 where not exists (select 1 from public.todos t where t.assignment_id = a.id and t.user_id = a.user_id);
