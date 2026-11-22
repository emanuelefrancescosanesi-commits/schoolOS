/**
 * Traduce i parametri con cui Supabase/Google rimandano l'utente al sito dopo un
 * accesso fallito nella chiave di `auth.queryErrors` mostrata nella pagina di login.
 *
 * Esempi reali: l'utente preme «Annulla» nella schermata di Google
 * (`error=access_denied`), oppure il provider non è abilitato in Supabase
 * (`error_code=validation_failed`, «Unsupported provider»).
 */
export function oauthErrorKey(params: URLSearchParams): "oauth" | "oauth_denied" | "oauth_unavailable" {
  const error = params.get("error");
  const code = params.get("error_code");
  const description = (params.get("error_description") ?? "").toLowerCase();
  if (error === "access_denied") return "oauth_denied";
  if (code === "validation_failed" || description.includes("unsupported provider") || description.includes("not enabled")) {
    return "oauth_unavailable";
  }
  return "oauth";
}
