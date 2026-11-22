"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/data/session";
import type { AssignmentRow } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { taskInputSchema } from "@/lib/validation/task";

export type TaskActionResult = { ok: true; task?: AssignmentRow } | { ok: false; error: string };
const DEMO: TaskActionResult = { ok: false, error: "demo" };

export async function addTask(input: Record<string, unknown>): Promise<TaskActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  await requireUser("/tasks");
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { subject_id, estimated_minutes, ...rest } = parsed.data;
  if (subject_id && !z.uuid().safeParse(subject_id).success) return { ok: false, error: "Materia non valida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert({ ...rest, subject_id: subject_id || null, estimated_minutes: estimated_minutes ?? null })
    .select("*")
    .single();
  if (error) return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  refresh();
  return { ok: true, task: data };
}

export async function updateTask(id: string, input: Record<string, unknown>): Promise<TaskActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Impegno non valido." };
  await requireUser("/tasks");
  const parsed = taskInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { subject_id, estimated_minutes, ...rest } = parsed.data;
  if (subject_id && !z.uuid().safeParse(subject_id).success) return { ok: false, error: "Materia non valida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .update({ ...rest, subject_id: subject_id || null, ...(estimated_minutes !== undefined && { estimated_minutes }) })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
  if (!data) return { ok: false, error: "Impegno non trovato." };
  refresh();
  return { ok: true, task: data };
}

export async function setTaskDone(id: string, done: boolean): Promise<TaskActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Impegno non valido." };
  await requireUser("/tasks");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .update(done ? { status: "done", completed_at: new Date().toISOString() } : { status: "todo", completed_at: null })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Impegno non trovato." };
  refresh();
  return { ok: true, task: data };
}

export async function deleteTask(id: string): Promise<TaskActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Impegno non valido." };
  await requireUser("/tasks");
  const supabase = await createClient();
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) return { ok: false, error: "Non siamo riusciti a eliminare." };
  refresh();
  return { ok: true };
}
