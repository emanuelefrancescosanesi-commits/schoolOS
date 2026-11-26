/** Lettura minima di Gmail: mittente, oggetto, data e anteprima. Mai il testo completo né gli allegati. */

const API = "https://gmail.googleapis.com/gmail/v1/users/me/messages";
const TIMEOUT = 10_000;

export interface GmailItem {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
  unread: boolean;
}

/** «Mario Rossi <m.rossi@scuola.it>» → «Mario Rossi»; senza nome resta l'indirizzo. */
export function senderName(from: string): string {
  const m = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  const name = m?.[1].trim();
  return (name || m?.[2] || from).trim().slice(0, 120);
}

const decodeEntities = (s: string) =>
  s.replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function get<T>(url: string, token: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 403 ? "Permesso Gmail non concesso." : "Gmail non risponde.");
  return (await res.json()) as T;
}

export async function listRecentInbox(token: string, opts: { days: number; max: number }): Promise<GmailItem[]> {
  const q = new URLSearchParams({ q: `in:inbox category:primary newer_than:${opts.days}d`, maxResults: String(opts.max) });
  const list = await get<{ messages?: { id: string }[] }>(`${API}?${q}`, token);
  const ids = (list.messages ?? []).map((m) => m.id);

  const meta = new URLSearchParams([["format", "metadata"], ...["From", "Subject"].map((h) => ["metadataHeaders", h])]);
  const items = await Promise.all(
    ids.map(async (id) => {
      const m = await get<{ id: string; snippet?: string; internalDate?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } }>(
        `${API}/${encodeURIComponent(id)}?${meta}`,
        token,
      );
      const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
      return {
        id: m.id,
        from: senderName(h("from")),
        subject: decodeEntities(h("subject")).trim().slice(0, 200) || "(senza oggetto)",
        snippet: decodeEntities(m.snippet ?? "").slice(0, 300),
        receivedAt: new Date(Number(m.internalDate) || Date.now()),
        unread: m.labelIds?.includes("UNREAD") ?? false,
      } satisfies GmailItem;
    }),
  );
  return items;
}
