-- SchoolOS · privilegi espliciti
--
-- I progetti Supabase nuovi non concedono più di default i privilegi sulle tabelle di `public`
-- ai ruoli dell'API: senza GRANT, la RLS non basta e ogni richiesta fallisce con 42501.
-- Concediamo solo ciò che serve; la RLS decide quali righe. Ogni tabella futura dovrà avere
-- i suoi GRANT nella propria migrazione.

grant usage on schema public to anon, authenticated;

-- Profili: lettura propria. L'update è già limitato a colonne specifiche (migrazione 1).
grant select on public.profiles to authenticated;

grant select, insert, update, delete
  on public.school_years, public.periods, public.subjects, public.grades, public.assignments
  to authenticated;

-- Gli anonimi non hanno accesso a nessuna tabella.
revoke all on all tables in schema public from anon;
