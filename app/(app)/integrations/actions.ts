"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { syncFeed } from "@/lib/calendar/sync";
import { normalizeFeedUrl } from "@/lib/calendar/feed-url";
import { requireOnboardedUser } from "@/lib/data/session";
import { dateKeyInTimeZone } from "@/lib/domain/dates";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type FeedActionResult = { ok: true; summary?: string } | { ok: false; error: string };
const DEMO: FeedActionResult = { ok: false, error: "demo" };
const STALE_MS = 30 * 60 * 1000;

const summary = (r: { added: number; updated: number; removed: number }) =>
  r.added + r.updated + r.removed === 0
    ? "Calendario già aggiornato."
    : `${r.added} nuovi, ${r.updated} modificati, ${r.removed} rimossi.`;

export async function addCalendarFeed(rawUrl: string, label: string): Promise<FeedActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  const { profile } = await requireOnboardedUser();
  const checked = normalizeFeedUrl(rawUrl);
  if (!checked.ok) return { ok: false, error: checked.error };
  const name = label.trim().slice(0, 60);

  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_feeds").insert({ url: checked.url, label: name }).select("id, url").single();
  if (error) {
    if (error.code === "53400") return { ok: false, error: "Puoi collegare al massimo 3 calendari." };
    if (error.code === "PGRST205" || error.code === "42P01") return { ok: false, error: "Questa funzione non è ancora attiva su questo database." };
    return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  }

  const today = dateKeyInTimeZone(new Date(), profile.time_zone);
  const res = await syncFeed(supabase, data, profile.time_zone, today);
  if (!res.ok) {
    // Un link che non funziona non resta salvato: l'errore si corregge al primo tentativo.
    await supabase.from("calendar_feeds").delete().eq("id", data.id);
    return { ok: false, error: res.error };
  }
  refresh();
  return { ok: true, summary: summary(res.result) };
}

export async function syncCalendarFeed(id: string): Promise<FeedActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Calendario non valido." };
  const { profile } = await requireOnboardedUser();
  const supabase = await createClient();
  const { data: feed } = await supabase.from("calendar_feeds").select("id, url").eq("id", id).maybeSingle();
  if (!feed) return { ok: false, error: "Calendario non trovato." };
  const res = await syncFeed(supabase, feed, profile.time_zone, dateKeyInTimeZone(new Date(), profile.time_zone));
  refresh();
  return res.ok ? { ok: true, summary: summary(res.result) } : { ok: false, error: res.error };
}

export async function removeCalendarFeed(id: string): Promise<FeedActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Calendario non valido." };
  await requireOnboardedUser();
  const supabase = await createClient();
  // Gli eventi importati spariscono con il calendario (cascata nel database).
  const { error } = await supabase.from("calendar_feeds").delete().eq("id", id);
  if (error) return { ok: false, error: "Non siamo riusciti a scollegare. Riprova." };
  refresh();
  return { ok: true };
}

/** Aggiorna i calendari non sincronizzati da più di 30 minuti (chiamata all'apertura del Calendario). */
export async function syncStaleFeeds(): Promise<{ changed: boolean }> {
  if (!isSupabaseConfigured()) return { changed: false };
  const { profile } = await requireOnboardedUser();
  const supabase = await createClient();
  const { data: feeds, error } = await supabase.from("calendar_feeds").select("id, url, last_synced_at, last_error");
  if (error || !feeds) return { changed: false };
  const today = dateKeyInTimeZone(new Date(), profile.time_zone);
  let changed = false;
  for (const f of feeds) {
    const last = f.last_synced_at ? Date.parse(f.last_synced_at) : 0;
    if (Date.now() - last < STALE_MS) continue;
    const res = await syncFeed(supabase, f, profile.time_zone, today);
    if (res.ok && res.result.added + res.result.updated + res.result.removed > 0) changed = true;
  }
  if (changed) refresh();
  return { changed };
}
