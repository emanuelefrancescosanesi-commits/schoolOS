/**
 * Origine pubblica del sito, usata nei link delle email (conferma, recupero password) e nel ritorno
 * da Google. Non va ricavata dall'header Host se si può evitare: chi controlla quell'header può far
 * arrivare alla vittima un link di recupero password che punta a un sito suo (host header poisoning).
 *
 * Ordine: NEXT_PUBLIC_SITE_URL → dominio di produzione di Vercel → dominio del deploy (Vercel) →
 * (solo in sviluppo) l'header Host. In produzione, senza nessuno dei primi tre, si rifiuta invece di
 * fidarsi dell'header. I valori VERCEL_* li imposta Vercel, non chi fa la richiesta.
 */
export interface OriginInput {
  configured?: string;
  vercelProductionHost?: string;
  vercelDeployHost?: string;
  host?: string | null;
  proto?: string | null;
  production: boolean;
}

const LOCAL_HOST = /^(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

export function resolveSiteOrigin(input: OriginInput): string {
  const configured = input.configured?.trim();
  if (configured) {
    let url: URL;
    try {
      url = new URL(configured);
    } catch {
      throw new Error("NEXT_PUBLIC_SITE_URL non è un indirizzo valido");
    }
    if (input.production && url.protocol !== "https:") throw new Error("NEXT_PUBLIC_SITE_URL deve usare https");
    return url.origin;
  }
  if (input.vercelProductionHost?.trim()) return `https://${input.vercelProductionHost.trim()}`;
  if (input.vercelDeployHost?.trim()) return `https://${input.vercelDeployHost.trim()}`;

  const host = input.host?.trim() ?? "";
  if (!input.production && host && /^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) {
    const proto = LOCAL_HOST.test(host) ? "http" : input.proto === "http" ? "http" : "https";
    return `${proto}://${host}`;
  }
  throw new Error("Imposta NEXT_PUBLIC_SITE_URL: senza, i link nelle email non possono essere generati in sicurezza");
}
