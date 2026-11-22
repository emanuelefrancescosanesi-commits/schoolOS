"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { findOverlap, trimTime } from "@/lib/domain/timetable";
import { slotInputSchema } from "@/lib/validation/timetable";

export type SlotActionResult = { ok: true; id?: string } | { ok: false; error: string };
const DEMO: SlotActionResult = { ok: false, error: "demo" };

/** Lezione del giorno che si sovrappone alla fascia indicata, letta sotto RLS (solo le proprie). */
async function overlapLabel(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slot: { weekday: number; starts_at: string; ends_at: string },
  ignoreId?: string,
): Promise<string | null> {
  const { data } = await supabase.from("timetable_slots").select("id, weekday, starts_at, ends_at, subject_id").eq("weekday", slot.weekday);
  const slots = (data ?? []).map((r) => ({ id: r.id, weekday: r.weekday, start: trimTime(r.starts_at), end: trimTime(r.ends_at) }));
  const hit = findOverlap(slots, { weekday: slot.weekday, start: slot.starts_at, end: slot.ends_at }, ignoreId);
  if (!hit) return null;
  const subjectId = data?.find((r) => r.id === hit.id)?.subject_id;
  const name = subjectId ? (await supabase.from("subjects").select("name").eq("id", subjectId).maybeSingle()).data?.name : undefined;
  return `${name ?? "un'altra lezione"} ${hit.start}–${hit.end}`;
}

export async function addSlot(input: Record<string, unknown>): Promise<SlotActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  await requireUser("/timetable");
  const parsed = slotInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { subject_id, room, ...rest } = parsed.data;
  if (subject_id && !z.uuid().safeParse(subject_id).success) return { ok: false, error: "Materia non valida." };

  const supabase = await createClient();
  const clash = await overlapLabel(supabase, parsed.data);
  if (clash) return { ok: false, error: `Si sovrappone a ${clash}.` };
  const { data, error } = await supabase
    .from("timetable_slots")
    .insert({ ...rest, subject_id: subject_id || null, room: room || null })
    .select("id, starts_at")
    .single();
  if (error) return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  refresh();
  return { ok: true, id: data.id };
}

export async function updateSlot(id: string, input: Record<string, unknown>): Promise<SlotActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Lezione non valida." };
  await requireUser("/timetable");
  const parsed = slotInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { subject_id, room, ...rest } = parsed.data;
  if (subject_id && !z.uuid().safeParse(subject_id).success) return { ok: false, error: "Materia non valida." };

  const supabase = await createClient();
  const clash = await overlapLabel(supabase, parsed.data, id);
  if (clash) return { ok: false, error: `Si sovrappone a ${clash}.` };
  const { data, error } = await supabase
    .from("timetable_slots")
    .update({ ...rest, subject_id: subject_id || null, room: room || null })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  if (!data) return { ok: false, error: "Lezione non trovata." };
  refresh();
  return { ok: true, id: data.id };
}

export async function deleteSlot(id: string): Promise<SlotActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Lezione non valida." };
  await requireUser("/timetable");
  const supabase = await createClient();
  const { error } = await supabase.from("timetable_slots").delete().eq("id", id);
  if (error) return { ok: false, error: "Non siamo riusciti a eliminare." };
  refresh();
  return { ok: true };
}
