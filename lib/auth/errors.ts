/** Messaggi in italiano per i codici d'errore di Supabase Auth. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o password non corrette.",
  email_not_confirmed: "Conferma prima l'email: ti abbiamo mandato un link.",
  user_already_exists: "Esiste già un account con questa email. Prova ad accedere.",
  email_exists: "Esiste già un account con questa email. Prova ad accedere.",
  weak_password: "Password troppo debole: usa almeno 8 caratteri, con lettere e numeri.",
  over_request_rate_limit: "Troppi tentativi. Riprova tra qualche minuto.",
  over_email_send_rate_limit: "Abbiamo già inviato un'email da poco. Riprova tra qualche minuto.",
  email_address_invalid: "Indirizzo email non valido.",
  same_password: "La nuova password deve essere diversa da quella attuale.",
  otp_expired: "Il link è scaduto o è già stato usato. Richiedine uno nuovo.",
  flow_state_expired: "La richiesta è scaduta. Riprova dall'inizio.",
  session_not_found: "La sessione è scaduta. Accedi di nuovo oppure richiedi un nuovo link.",
  session_expired: "La sessione è scaduta. Accedi di nuovo.",
  reauthentication_needed: "Per sicurezza, esci e rientra nell'account, poi riprova.",
  reauthentication_not_valid: "Il codice di verifica non è valido. Riprova.",
  email_change_confirm_limit: "Hai già richiesto un cambio email da poco. Riprova tra qualche minuto.",
  signup_disabled: "Le registrazioni sono temporaneamente chiuse.",
};

export const GENERIC_AUTH_ERROR = "Qualcosa non ha funzionato. Riprova tra un attimo.";

export function authErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return GENERIC_AUTH_ERROR;
  return (error.code && MESSAGES[error.code]) || GENERIC_AUTH_ERROR;
}
