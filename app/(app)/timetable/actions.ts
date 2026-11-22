"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/session";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { slotInputSchema } from "@/lib/validation/timetable";

export type SlotActionResult = { ok: true; id?: string } | { ok: false; error: string };
const DEMO: SlotActionResult = { ok: false, error: "demo" };

export async function addSlot(input: Record<string, unknown>): Promise<SlotActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  await requireUser("/timetable");
  const parsed = slotInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { subject_id, room, ...rest } = parsed.data;
  if (subject_id && !z.uuid().safeParse(subject_id).success) return { ok: false, error: "Materia non valida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("timetable_slots")
    .insert({ ...rest, subject_id: subject_id || null, room: room || null })
    .select("id, starts_at")
    .single();
  if (error) return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
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
