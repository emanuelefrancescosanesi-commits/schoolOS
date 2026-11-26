export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  tokenKey: string;
}

/** Il collegamento è attivo solo se Vercel ha tutte e tre le variabili; altrimenti la UI lo dice chiaramente. */
export function googleConfig(env: Record<string, string | undefined> = process.env): GoogleConfig | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const tokenKey = env.GOOGLE_TOKEN_KEY?.trim();
  if (!clientId || !clientSecret || !tokenKey) return null;
  return { clientId, clientSecret, tokenKey };
}
