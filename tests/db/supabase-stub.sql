-- Riproduce la parte di Supabase da cui dipendono le migrazioni, per testarle su un
-- Postgres qualsiasi (in locale o in CI): schema auth, auth.uid(), ruoli e privilegi
-- predefiniti. Non va mai applicato a un progetto Supabase reale.

create schema if not exists auth;
create schema if not exists extensions;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'
);

-- Come in Supabase: l'id utente arriva dal claim "sub" del JWT della richiesta.
create function auth.uid() returns uuid
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

-- I ruoli sono globali al server: i file di test girano in parallelo, quindi la creazione
-- deve tollerare un altro processo che crea lo stesso ruolo nello stesso istante.
do $$
declare
  r record;
begin
  for r in select * from (values ('anon', false), ('authenticated', false), ('service_role', true)) as t(name, bypass) loop
    begin
      if not exists (select from pg_roles where rolname = r.name) then
        execute format('create role %I nologin %s', r.name, case when r.bypass then 'bypassrls' else '' end);
      end if;
    exception when duplicate_object or unique_violation then
      null;
    end;
  end loop;
end;
$$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- I progetti Supabase nuovi NON concedono privilegi di default sulle tabelle di public:
-- lo stub non deve farlo, così i test falliscono se una migrazione dimentica i GRANT.
