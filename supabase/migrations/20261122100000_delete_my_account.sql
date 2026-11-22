-- Cancellazione dell'account da parte dello studente (obbligatoria per GDPR e per gli store).
-- Il client non può toccare auth.users: la funzione, con privilegi del proprietario, elimina solo
-- l'utente della sessione. Tutte le tabelle dell'app puntano a auth.users con "on delete cascade":
-- profilo, anni scolastici, materie, voti, compiti, codici dell'estensione e quote AI spariscono.
create or replace function public.delete_my_account() returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato' using errcode = '28000';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
