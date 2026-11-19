-- SchoolOS · piano dell'utente (gratuito / Pro)
--
-- Il piano decide quali funzioni automatiche sono attive (es. lettura dei voti con l'AI).
-- Lo imposta solo il server (un giorno il webhook dei pagamenti): il client non può modificarlo,
-- perché la migrazione 1 concede l'UPDATE solo alle colonne elencate e `plan` non è tra queste.

create type public.plan as enum ('free', 'pro');

alter table public.profiles add column plan public.plan not null default 'free';
