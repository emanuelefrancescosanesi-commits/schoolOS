import "server-only";
import { lookup } from "node:dns/promises";
import { isPrivateIp, normalizeFeedUrl } from "./feed-url";

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8_000;

export class FeedFetchError extends Error {}

/** Il nome del sito deve risolvere solo a indirizzi pubblici (difesa da SSRF e da DNS «interni»). */
async function assertPublicHost(hostname: string): Promise<void> {
  let addrs: { address: string }[];
  try {
    addrs = await lookup(hostname, { all: true });
  } catch {
    throw new FeedFetchError("Non riusciamo a raggiungere questo indirizzo.");
  }
  if (addrs.length === 0 || addrs.some((a) => isPrivateIp(a.address))) throw new FeedFetchError("Indirizzo non consentito.");
}

/** Scarica un calendario iCal: solo https pubblico, max 3 reindirizzamenti, 2 MB, 8 secondi. */
export async function fetchFeedText(rawUrl: string): Promise<string> {
  let url = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const ok = normalizeFeedUrl(url);
    if (!ok.ok) throw new FeedFetchError(ok.error);
    await assertPublicHost(new URL(ok.url).hostname);

    let res: Response;
    try {
      res = await fetch(ok.url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { Accept: "text/calendar, text/plain;q=0.8, */*;q=0.1", "User-Agent": "SchoolOS-calendar" },
        cache: "no-store",
      });
    } catch {
      throw new FeedFetchError("Il calendario non risponde. Riprova più tardi.");
    }

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) throw new FeedFetchError("Risposta non valida dal calendario.");
      url = new URL(next, ok.url).toString();
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      throw new FeedFetchError("Il calendario non è più raggiungibile: l'indirizzo è cambiato o è stato revocato.");
    }
    if (!res.ok || !res.body) throw new FeedFetchError("Il calendario ha risposto con un errore.");

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new FeedFetchError("Il calendario è troppo grande.");
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
  }
  throw new FeedFetchError("Troppi reindirizzamenti.");
}
