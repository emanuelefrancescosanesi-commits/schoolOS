import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays } from "@/lib/domain/dates";
import type { Database } from "@/lib/supabase/database.types";
import { FeedFetchError, fetchFeedText } from "./fetch-feed";
import { type ImportedEvent, parseIcal } from "./ical";

export interface SyncResult {
  added: number;
  updated: number;
  removed: number;
}

const FROM_DAYS = -14;
const TO_DAYS = 270;
const CHUNK = 200;

/** Differenza tra gli eventi già salvati di un calendario e quelli appena letti. */
export function diffImported(
  existing: { id: string; external_id: string | null; title: string; kind: string; starts_on: string; starts_at: string | null; notes: string | null }[],
  incoming: ImportedEvent[],
) {
  const byExt = new Map(existing.map((e) => [e.external_id, e]));
  const incomingIds = new Set(incoming.map((e) => e.externalId));
  const toInsert = incoming.filter((e) => !byExt.has(e.externalId));
  const toUpdate: { id: string; ev: ImportedEvent }[] = [];
  for (const ev of incoming) {
    const old = byExt.get(ev.externalId);
    if (!old) continue;
    const same =
      old.title === ev.title && old.kind === ev.kind && old.starts_on === ev.date &&
      (old.starts_at?.slice(0, 5) ?? null) === (ev.time ?? null) && (old.notes ?? null) === (ev.notes ?? null);
    if (!same) toUpdate.push({ id: old.id, ev });
  }
  const toDelete = existing.filter((e) => e.external_id && !incomingIds.has(e.external_id)).map((e) => e.id);
  return { toInsert, toUpdate, toDelete };
}

/**
 * Scarica il calendario, aggiorna gli eventi importati (nuovi, cambiati, spariti) e registra
 * l'esito. In caso di errore gli eventi già importati restano al loro posto.
 */
export async function syncFeed(
  supabase: SupabaseClient<Database>,
  feed: { id: string; url: string },
  timeZone: string,
  today: string,
): Promise<{ ok: true; result: SyncResult } | { ok: false; error: string }> {
  const fail = async (error: string) => {
    await supabase.from("calendar_feeds").update({ last_error: error.slice(0, 200) }).eq("id", feed.id);
    return { ok: false as const, error };
  };

  let incoming: ImportedEvent[];
  try {
    incoming = parseIcal(await fetchFeedText(feed.url), { timeZone, from: addDays(today, FROM_DAYS), to: addDays(today, TO_DAYS) });
  } catch (e) {
    return fail(e instanceof FeedFetchError || e instanceof Error ? e.message : "Sincronizzazione non riuscita.");
  }

  const { data: existing, error } = await supabase
    .from("events")
    .select("id, external_id, title, kind, starts_on, starts_at, notes")
    .eq("feed_id", feed.id)
    .limit(2000);
  if (error) return fail("Non siamo riusciti a leggere gli eventi salvati.");

  const { toInsert, toUpdate, toDelete } = diffImported(existing, incoming);

  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const { error: e } = await supabase.from("events").delete().in("id", toDelete.slice(i, i + CHUNK));
    if (e) return fail("Non siamo riusciti ad aggiornare il calendario.");
  }
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const rows = toInsert.slice(i, i + CHUNK).map((e) => ({
      feed_id: feed.id,
      external_id: e.externalId,
      title: e.title,
      kind: e.kind,
      starts_on: e.date,
      starts_at: e.time ?? null,
      notes: e.notes ?? null,
    }));
    const { error: e } = await supabase.from("events").insert(rows);
    if (e) return fail(e.code === "53400" ? "Hai raggiunto il numero massimo di impegni nel calendario." : "Non siamo riusciti a salvare gli eventi.");
  }
  for (const { id, ev } of toUpdate) {
    const { error: e } = await supabase
      .from("events")
      .update({ title: ev.title, kind: ev.kind, starts_on: ev.date, starts_at: ev.time ?? null, notes: ev.notes ?? null })
      .eq("id", id);
    if (e) return fail("Non siamo riusciti ad aggiornare il calendario.");
  }

  await supabase.from("calendar_feeds").update({ last_synced_at: new Date().toISOString(), last_error: null }).eq("id", feed.id);
  return { ok: true, result: { added: toInsert.length, updated: toUpdate.length, removed: toDelete.length } };
}
