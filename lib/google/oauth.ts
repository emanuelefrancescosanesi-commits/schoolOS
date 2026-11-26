/** OAuth 2.0 con Google (flusso «codice di autorizzazione», accesso offline per il refresh token). */

export const GOOGLE_SCOPES = {
  openid: "openid",
  email: "email",
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
} as const;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const TIMEOUT = 10_000;

export class GoogleAuthError extends Error {
  constructor(message: string, readonly revoked = false) {
    super(message);
  }
}

export function buildAuthUrl(p: { clientId: string; redirectUri: string; state: string; loginHint?: string }): string {
  const u = new URL(AUTH_URL);
  u.search = new URLSearchParams({
    client_id: p.clientId,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: Object.values(GOOGLE_SCOPES).join(" "),
    access_type: "offline",
    // prompt=consent: senza, Google non rimanda il refresh token a un secondo collegamento.
    prompt: "consent",
    include_granted_scopes: "true",
    state: p.state,
    ...(p.loginHint ? { login_hint: p.loginHint } : {}),
  }).toString();
  return u.toString();
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
}

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  let res: Response;
  try {
    res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
      signal: AbortSignal.timeout(TIMEOUT),
      cache: "no-store",
    });
  } catch {
    throw new GoogleAuthError("Google non risponde. Riprova più tardi.");
  }
  const json = (await res.json().catch(() => ({}))) as TokenResponse;
  if (!res.ok) {
    // invalid_grant: collegamento revocato dall'utente o scaduto (in modalità test dopo 7 giorni).
    throw new GoogleAuthError(json.error === "invalid_grant" ? "Il collegamento con Google è scaduto: ricollega Google." : "Google ha rifiutato la richiesta.", json.error === "invalid_grant");
  }
  return json;
}

export async function exchangeCode(c: { clientId: string; clientSecret: string }, code: string, redirectUri: string) {
  const t = await postToken({ client_id: c.clientId, client_secret: c.clientSecret, code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.access_token) throw new GoogleAuthError("Google non ha dato l'accesso.");
  return { accessToken: t.access_token, refreshToken: t.refresh_token, scope: t.scope ?? "", idToken: t.id_token };
}

export async function refreshAccessToken(c: { clientId: string; clientSecret: string }, refreshToken: string): Promise<{ accessToken: string; scope: string }> {
  const t = await postToken({ client_id: c.clientId, client_secret: c.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
  if (!t.access_token) throw new GoogleAuthError("Google non ha dato l'accesso.");
  return { accessToken: t.access_token, scope: t.scope ?? "" };
}

/** Revoca (best effort) il collegamento presso Google quando lo studente scollega. */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
  } catch {
    // Se Google non risponde, il collegamento locale viene comunque eliminato.
  }
}

/** Email dell'account dall'id_token (la firma non serve: arriva direttamente da Google via TLS). */
export function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export const hasScope = (scopes: string, key: "calendar" | "gmail") => scopes.split(/\s+/).includes(GOOGLE_SCOPES[key]);
