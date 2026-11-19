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

do $$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end;
$$;

grant usage on schema public, auth, extensions to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase concede di default tutti i privilegi su public a questi ruoli: la sicurezza
-- deve quindi venire dalla RLS e dalle revoche esplicite nelle migrazioni.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
