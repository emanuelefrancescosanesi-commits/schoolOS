import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { diffImported, type SyncResult } from "@/lib/calendar/sync";
import { addDays } from "@/lib/domain/dates";
import type { Database } from "@/lib/supabase/database.types";
import { listCalendarEvents } from "./calendar";
import { googleConfig } from "./config";
import { decryptToken } from "./crypto";
import { listRecentInbox } from "./gmail";
import { GoogleAuthError, hasScope, refreshAccessToken } from "./oauth";

export interface GoogleSyncResult {
  events: SyncResult | null;
  messagesAdded: number | null;
}

const FROM_DAYS = -14;
const TO_DAYS = 270;
const MAIL_DAYS = 14;
const MAIL_MAX = 30;
const KEEP_MAIL_DAYS = 30;
const CHUNK = 200;

type Sb = SupabaseClient<Database>;

async function syncEvents(sb: Sb, token: string, tz: string, today: string): Promise<SyncResult> {
  const incoming = await listCalendarEvents(token, { from: addDays(today, FROM_DAYS), to: addDays(today, TO_DAYS), timeZone: tz });
  const { data, error } = await sb
    .from("events")
    .select("id, google_event_id, title, kind, starts_on, starts_at, notes")
    .not("google_event_id", "is", null)
    .limit(2000);
  if (error) throw new Error("Non siamo riusciti a leggere gli eventi salvati.");
  const { toInsert, toUpdate, toDelete } = diffImported(data.map((r) => ({ ...r, external_id: r.google_event_id })), incoming);

  for (let i = 0; i < toDelete.length; i += CHUNK) {
    const { error: e } = await sb.from("events").delete().in("id", toDelete.slice(i, i + CHUNK));
    if (e) throw new Error("Non siamo riusciti ad aggiornare il calendario.");
  }
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    const rows = toInsert.slice(i, i + CHUNK).map((e) => ({
      google_event_id: e.externalId, title: e.title, kind: e.kind, starts_on: e.date, starts_at: e.time ?? null, notes: e.notes ?? null,
    }));
    const { error: e } = await sb.from("events").insert(rows);
    if (e) throw new Error(e.code === "53400" ? "Hai raggiunto il numero massimo di impegni nel calendario." : "Non siamo riusciti a salvare gli eventi.");
  }
  for (const { id, ev } of toUpdate) {
    const { error: e } = await sb.from("events").update({ title: ev.title, kind: ev.kind, starts_on: ev.date, starts_at: ev.time ?? null, notes: ev.notes ?? null }).eq("id", id);
    if (e) throw new Error("Non siamo riusciti ad aggiornare il calendario.");
  }
  return { added: toInsert.length, updated: toUpdate.length, removed: toDelete.length };
}

async function syncMail(sb: Sb, token: string): Promise<number> {
  // Si tiene un mese di posta: le mail importate più vecchie vengono eliminate (meno dati personali custoditi).
  const cutoff = new Date(Date.now() - KEEP_MAIL_DAYS * 86_400_000).toISOString();
  await sb.from("inbox_messages").delete().not("external_id", "is", null).lt("received_at", cutoff);

  const items = await listRecentInbox(token, { days: MAIL_DAYS, max: MAIL_MAX });
  if (items.length === 0) return 0;
  const { data, error } = await sb.from("inbox_messages").select("external_id").in("external_id", items.map((i) => `gmail:${i.id}`));
  if (error) throw new Error("Non siamo riusciti a leggere l'Inbox.");
  const have = new Set(data.map((r) => r.external_id));
  const fresh = items.filter((i) => !have.has(`gmail:${i.id}`));
  if (fresh.length === 0) return 0;
  const { error: e } = await sb.from("inbox_messages").insert(
    fresh.map((i) => ({
      external_id: `gmail:${i.id}`,
      source: "email" as const,
      sender: i.from,
      title: i.subject,
      body: i.snippet,
      received_at: i.receivedAt.toISOString(),
      is_read: !i.unread,
    })),
  );
  if (e) throw new Error(e.code === "53400" ? "Hai raggiunto il numero massimo di comunicazioni." : "Non siamo riusciti a salvare le mail.");
  return fresh.length;
}

/** Sincronizza Calendar e Gmail dell'utente. Un errore su una delle due non blocca l'altra. */
export async function syncGoogle(
  sb: Sb,
  userId: string,
  timeZone: string,
  today: string,
): Promise<{ ok: true; result: GoogleSyncResult } | { ok: false; error: string }> {
  const cfg = googleConfig();
  if (!cfg) return { ok: false, error: "Il collegamento a Google non è ancora attivo." };
  const { data: conn } = await sb.from("google_connections").select("*").eq("user_id", userId).maybeSingle();
  if (!conn) return { ok: false, error: "Google non è collegato." };

  const record = async (error: string | null) => {
    await sb.from("google_connections").update({ last_error: error?.slice(0, 200) ?? null, ...(error ? {} : { last_synced_at: new Date().toISOString() }) }).eq("user_id", userId);
    return error;
  };

  let access: { accessToken: string; scope: string };
  try {
    access = await refreshAccessToken(cfg, decryptToken(conn.refresh_token_enc, cfg.tokenKey));
  } catch (e) {
    const msg = e instanceof GoogleAuthError ? e.message : "Non riusciamo a leggere il collegamento con Google: ricollegalo.";
    await record(msg);
    return { ok: false, error: msg };
  }

  const scopes = access.scope || conn.scopes;
  const result: GoogleSyncResult = { events: null, messagesAdded: null };
  const errors: string[] = [];
  if (hasScope(scopes, "calendar")) {
    try {
      result.events = await syncEvents(sb, access.accessToken, timeZone, today);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Calendar non riuscito.");
    }
  }
  if (hasScope(scopes, "gmail")) {
    try {
      result.messagesAdded = await syncMail(sb, access.accessToken);
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Gmail non riuscito.");
    }
  }
  await record(errors[0] ?? null);
  return errors.length && result.events === null && result.messagesAdded === null ? { ok: false, error: errors[0] } : { ok: true, result };
}
