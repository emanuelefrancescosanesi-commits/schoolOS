/**
 * Limite di tentativi in memoria, per chiave (es. id utente). È un freno aggiuntivo
 * "best effort": su serverless ogni istanza ha il suo contatore, quindi il limite
 * vero resta quello di Supabase Auth. Serve a frenare chi prova a indovinare la
 * password attuale da una sessione rubata.
 */
export function createRateLimiter(max: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return {
    /** Registra un tentativo. Restituisce false se la chiave ha superato il limite. */
    attempt(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 5000) for (const [k, v] of hits) if (v.every((x) => t - x >= windowMs)) hits.delete(k);
      return true;
    },
    reset(key: string) {
      hits.delete(key);
    },
  };
}
