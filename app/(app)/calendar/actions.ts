"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { type EventInput, eventInputSchema } from "@/lib/validation/event";

export type EventActionResult = { ok: true; id?: string } | { ok: false; error: string };
const DEMO: EventActionResult = { ok: false, error: "demo" };

type Parsed = { error: string; row?: undefined } | { error?: undefined; row: EventInsert };
type EventInsert = {
  title: string;
  kind: EventInput["kind"];
  starts_on: string;
  starts_at: string | null;
  subject_id: string | null;
  notes: string | null;
};

function parse(input: Record<string, unknown>): Parsed {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { subject_id, starts_at, notes, ...rest } = parsed.data;
  if (subject_id && !z.uuid().safeParse(subject_id).success) return { error: "Materia non valida." };
  return { row: { ...rest, subject_id: subject_id || null, starts_at: starts_at || null, notes: notes || null } };
}

export async function addEvent(input: Record<string, unknown>): Promise<EventActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  await requireUser("/calendar");
  const p = parse(input);
  if (p.error !== undefined) return { ok: false, error: p.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").insert(p.row).select("id").single();
  if (error) return { ok: false, error: saveError(error.code) };
  refresh();
  return { ok: true, id: data.id };
}

export async function updateEvent(id: string, input: Record<string, unknown>): Promise<EventActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Impegno non valido." };
  await requireUser("/calendar");
  const p = parse(input);
  if (p.error !== undefined) return { ok: false, error: p.error };

  const supabase = await createClient();
  const { data, error } = await supabase.from("events").update(p.row).eq("id", id).select("id");
  if (error) return { ok: false, error: saveError(error.code) };
  // RLS: l'evento di un altro utente (o già eliminato) non viene toccato.
  if (!data?.length) return { ok: false, error: "Impegno non trovato." };
  refresh();
  return { ok: true, id };
}

export async function deleteEvent(id: string): Promise<EventActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Impegno non valido." };
  await requireUser("/calendar");
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { ok: false, error: "Non siamo riusciti a eliminare." };
  refresh();
  return { ok: true };
}

function saveError(code: string | undefined): string {
  if (code === "53400") return "Hai raggiunto il numero massimo di impegni.";
  if (code === "PGRST205" || code === "42P01") return "Il calendario non è ancora attivo su questo database.";
  return "Non siamo riusciti a salvare. Riprova.";
}
