import { classifyTitle, type ImportedEvent } from "@/lib/calendar/ical";
import { type DateKey, addDays, dateKeyInTimeZone, diffDays, timeInTimeZone } from "@/lib/domain/dates";

const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const TIMEOUT = 10_000;

interface GEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

const clean = (s: string | undefined, max: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Converte gli eventi di Google (già espansi, una riga per ripetizione) nel formato dell'app. */
export function mapGoogleEvents(items: GEvent[], timeZone: string): ImportedEvent[] {
  const out: ImportedEvent[] = [];
  for (const e of items) {
    if (e.status === "cancelled" || !e.start) continue;
    const title = clean(e.summary, 140) || "Evento";
    const notes = clean(e.description, 500) || undefined;
    const kind = classifyTitle(title);
    if (e.start.date) {
      // Tutto il giorno: la data di fine è esclusiva; un evento per giorno, fino a 14.
      const last = e.end?.date ? addDays(e.end.date, -1) : e.start.date;
      const days = Math.min(Math.max(diffDays(e.start.date, last), 0), 13);
      for (let i = 0; i <= days; i++) {
        out.push({ externalId: `${e.id}${i ? `#${i}` : ""}`.slice(0, 300), title, notes, kind, date: addDays(e.start.date, i) });
      }
    } else if (e.start.dateTime) {
      const at = new Date(e.start.dateTime);
      if (Number.isNaN(at.getTime())) continue;
      out.push({ externalId: e.id.slice(0, 300), title, notes, kind, date: dateKeyInTimeZone(at, timeZone), time: timeInTimeZone(at, timeZone) });
    }
  }
  return out;
}

export async function listCalendarEvents(token: string, opts: { from: DateKey; to: DateKey; timeZone: string }): Promise<ImportedEvent[]> {
  const items: GEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 4; page++) {
    const q = new URLSearchParams({
      timeMin: new Date(`${opts.from}T00:00:00Z`).toISOString(),
      timeMax: new Date(`${addDays(opts.to, 1)}T00:00:00Z`).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`${API}?${q}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
    if (!res.ok) throw new Error(res.status === 403 ? "Permesso Calendar non concesso." : "Google Calendar non risponde.");
    const json = (await res.json()) as { items?: GEvent[]; nextPageToken?: string };
    items.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return mapGoogleEvents(items, opts.timeZone);
}
