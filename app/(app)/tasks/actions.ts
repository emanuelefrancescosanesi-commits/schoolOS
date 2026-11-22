"use server";

import { z } from "zod";
import { requireOnboardedUser } from "@/lib/data/session";
import { dateKeyInTimeZone, isDateKey } from "@/lib/domain/dates";
import type { Database, Json, TodoRow } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { completionPatch } from "@/lib/todo/complete";
import { labelFromRow, projectFromRow, todoFromRow } from "@/lib/todo/mappers";
import { parseRecurrence } from "@/lib/todo/recurrence";
import type { Todo, TodoLabel, TodoProject } from "@/lib/todo/types";

/**
 * Azioni server della lista "Da fare". Ogni azione:
 *  1. valida l'input con zod (il client non è mai fidato);
 *  2. scrive con il client dell'utente, quindi sotto RLS: anche un id altrui non produce effetti;
 *  3. restituisce le righe salvate, così la UI si riallinea senza ricaricare la pagina.
 */

type Fail = { ok: false; error: string };
type Ok<T> = { ok: true } & T;
export type ActionResult<T = object> = Ok<T> | Fail;

const DEMO: Fail = { ok: false, error: "demo" };

const uuid = z.uuid();
const dateKey = z.string().refine(isDateKey, "Data non valida");
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Orario non valido");
const recurrenceSchema = z
  .object({
    freq: z.enum(["day", "week", "month"]),
    interval: z.number().int().min(1).max(365),
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  })
  .transform((r) => parseRecurrence(r));

const fields = {
  title: z.string().trim().min(1, "Scrivi un titolo").max(200, "Massimo 200 caratteri"),
  notes: z.string().max(4000, "Massimo 4000 caratteri").nullable(),
  due: dateKey.nullable(),
  time: timeOfDay.nullable(),
  priority: z.number().int().min(1).max(4),
  recurrence: recurrenceSchema.nullable(),
  projectId: uuid.nullable(),
  subjectId: uuid.nullable(),
  labels: z.array(z.string().trim().min(1).max(30).regex(/^\S+$/)).max(8),
};

const createSchema = z.object({
  title: fields.title,
  notes: fields.notes.optional(),
  due: fields.due.optional(),
  time: fields.time.optional(),
  priority: fields.priority.optional(),
  recurrence: fields.recurrence.optional(),
  projectId: fields.projectId.optional(),
  parentId: uuid.nullable().optional(),
  subjectId: fields.subjectId.optional(),
  assignmentId: uuid.nullable().optional(),
  labels: fields.labels.optional(),
});

const patchSchema = z.object({
  title: fields.title.optional(),
  notes: fields.notes.optional(),
  due: fields.due.optional(),
  time: fields.time.optional(),
  priority: fields.priority.optional(),
  recurrence: fields.recurrence.optional(),
  projectId: fields.projectId.optional(),
  subjectId: fields.subjectId.optional(),
  labels: fields.labels.optional(),
});

export type CreateTodoInput = z.input<typeof createSchema>;
export type UpdateTodoPatch = z.input<typeof patchSchema>;

async function session() {
  const { profile } = await requireOnboardedUser();
  return { supabase: await createClient(), today: dateKeyInTimeZone(new Date(), profile.time_zone) };
}
type Session = Awaited<ReturnType<typeof session>>;

function dbError(error: { code?: string; message: string; details?: string }): Fail {
  if (error.code === "23514" && /_limit/.test(`${error.message} ${error.details ?? ""}`)) {
    return { ok: false, error: "Hai raggiunto il limite del tuo account. Elimina qualcosa che non ti serve più." };
  }
  if (error.code === "23514" && /single_level/.test(`${error.message} ${error.details ?? ""}`)) {
    return { ok: false, error: "Le sotto-attività hanno un solo livello." };
  }
  if (error.code === "23505") return { ok: false, error: "Esiste già un elemento con questo nome." };
  if (error.code === "23503") return { ok: false, error: "Elemento collegato non trovato." };
  return { ok: false, error: "Non siamo riusciti a salvare. Riprova." };
}

const invalid = (error: z.ZodError): Fail => ({ ok: false, error: error.issues[0]?.message ?? "Dati non validi." });

/** Trova o crea le etichette per nome (senza distinguere maiuscole). Restituisce quelle usate, esistenti e nuove. */
async function resolveLabels(s: Session, names: string[]): Promise<{ ids: string[]; resolved: TodoLabel[] } | Fail> {
  const unique = [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];
  if (unique.length === 0) return { ids: [], resolved: [] };
  const existing = await s.supabase.from("todo_labels").select("*");
  if (existing.error) return dbError(existing.error);
  const byName = new Map(existing.data.map((l) => [l.name.toLowerCase(), l.id]));
  const resolved: TodoLabel[] = [];
  const ids: string[] = [];
  for (const name of unique) {
    const found = byName.get(name.toLowerCase());
    if (found) {
      ids.push(found);
      resolved.push({ id: found, name: existing.data.find((l) => l.id === found)!.name });
      continue;
    }
    const ins = await s.supabase.from("todo_labels").insert({ name }).select("*").single();
    if (ins.error) return dbError(ins.error);
    resolved.push(labelFromRow(ins.data));
    ids.push(ins.data.id);
  }
  return { ids, resolved };
}

async function replaceLinks(s: Session, todoId: string, labelIds: string[]): Promise<Fail | null> {
  const del = await s.supabase.from("todo_label_links").delete().eq("todo_id", todoId);
  if (del.error) return dbError(del.error);
  if (labelIds.length === 0) return null;
  const ins = await s.supabase.from("todo_label_links").insert(labelIds.map((label_id) => ({ todo_id: todoId, label_id })));
  return ins.error ? dbError(ins.error) : null;
}

/** Righe del database → attività con le loro etichette (una sola query per tutte). */
async function withLabels(s: Session, rows: TodoRow[]): Promise<Todo[]> {
  if (rows.length === 0) return [];
  const { data } = await s.supabase.from("todo_label_links").select("todo_id, label_id").in("todo_id", rows.map((r) => r.id));
  const byTodo = new Map<string, string[]>();
  for (const l of data ?? []) byTodo.set(l.todo_id, [...(byTodo.get(l.todo_id) ?? []), l.label_id]);
  return rows.map((r) => todoFromRow(r, byTodo.get(r.id) ?? []));
}

export async function createTodo(input: CreateTodoInput): Promise<ActionResult<{ todo: Todo; labels: TodoLabel[] }>> {
  if (!isSupabaseConfigured()) return DEMO;
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const s = await session();

  const labels = await resolveLabels(s, v.labels ?? []);
  if ("ok" in labels) return labels;

  const due = v.due ?? null;
  const ins = await s.supabase
    .from("todos")
    .insert({
      title: v.title,
      notes: v.notes ?? null,
      due_on: due,
      due_time: due ? (v.time ?? null) : null,
      priority: v.priority ?? 4,
      recurrence: due && !v.parentId ? ((v.recurrence ?? null) as Json | null) : null,
      project_id: v.projectId ?? null,
      parent_id: v.parentId ?? null,
      subject_id: v.subjectId ?? null,
      assignment_id: v.assignmentId ?? null,
    })
    .select("*")
    .single();
  if (ins.error) return dbError(ins.error);

  const linkError = await replaceLinks(s, ins.data.id, labels.ids);
  if (linkError) return linkError;
  return { ok: true, todo: todoFromRow(ins.data, labels.ids), labels: labels.resolved };
}

export async function updateTodo(id: string, patch: UpdateTodoPatch): Promise<ActionResult<{ todo: Todo; children: Todo[]; labels: TodoLabel[] }>> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Attività non valida." };
  const parsed = patchSchema.safeParse(patch);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const s = await session();

  const update: Database["public"]["Tables"]["todos"]["Update"] = {};
  if (v.title !== undefined) update.title = v.title;
  if (v.notes !== undefined) update.notes = v.notes;
  if (v.priority !== undefined) update.priority = v.priority;
  if (v.projectId !== undefined) update.project_id = v.projectId;
  if (v.subjectId !== undefined) update.subject_id = v.subjectId;
  if (v.due !== undefined) {
    update.due_on = v.due;
    // Senza scadenza non esistono né orario né ricorrenza.
    if (v.due === null) {
      update.due_time = null;
      update.recurrence = null;
    }
  }
  if (v.time !== undefined && v.due !== null) update.due_time = v.time;
  if (v.recurrence !== undefined && v.due !== null) update.recurrence = v.recurrence as Json | null;

  let resolvedLabels: TodoLabel[] = [];
  let labelIds: string[] | null = null;
  if (v.labels) {
    const labels = await resolveLabels(s, v.labels);
    if ("ok" in labels) return labels;
    resolvedLabels = labels.resolved;
    labelIds = labels.ids;
  }

  if (Object.keys(update).length > 0) {
    const upd = await s.supabase.from("todos").update(update).eq("id", id).select("*").maybeSingle();
    if (upd.error) return dbError(upd.error);
    if (!upd.data) return { ok: false, error: "Attività non trovata." };
  }
  if (labelIds) {
    const linkError = await replaceLinks(s, id, labelIds);
    if (linkError) return linkError;
  }

  const row = await s.supabase.from("todos").select("*").eq("id", id).maybeSingle();
  if (row.error) return dbError(row.error);
  if (!row.data) return { ok: false, error: "Attività non trovata." };
  // Cambiando lista, le sotto-attività la seguono (trigger): le rimandiamo aggiornate.
  const kids = await s.supabase.from("todos").select("*").eq("parent_id", id);
  const [todo, ...children] = await withLabels(s, [row.data, ...(kids.data ?? [])]);
  return { ok: true, todo, children, labels: resolvedLabels };
}

/** Spunta o de-spunta. Le ricorrenti scorrono alla prossima data; completare un genitore chiude le sue sotto-attività. */
export async function toggleTodo(id: string): Promise<ActionResult<{ changed: Todo[] }>> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Attività non valida." };
  const s = await session();

  const cur = await s.supabase.from("todos").select("*").eq("id", id).maybeSingle();
  if (cur.error) return dbError(cur.error);
  if (!cur.data) return { ok: false, error: "Attività non trovata." };

  const now = new Date();
  const current = todoFromRow(cur.data);
  const patch = completionPatch(current, s.today, now);
  const changedIds = [id];

  if (patch.kind === "rolled") {
    const upd = await s.supabase.from("todos").update({ due_on: patch.due }).eq("id", id);
    if (upd.error) return dbError(upd.error);
  } else if (patch.kind === "done") {
    const upd = await s.supabase.from("todos").update({ completed_at: patch.completedAt }).eq("id", id);
    if (upd.error) return dbError(upd.error);
    if (current.parentId === null) {
      const kids = await s.supabase
        .from("todos")
        .update({ completed_at: patch.completedAt })
        .eq("parent_id", id)
        .is("completed_at", null)
        .select("id");
      if (kids.error) return dbError(kids.error);
      changedIds.push(...kids.data.map((k) => k.id));
    }
  } else {
    const upd = await s.supabase.from("todos").update({ completed_at: null }).eq("id", id);
    if (upd.error) return dbError(upd.error);
  }

  // Un'attività nata da un compito della scuola lo tiene allineato.
  if (cur.data.assignment_id && patch.kind !== "rolled") {
    await s.supabase
      .from("assignments")
      .update(patch.kind === "done" ? { status: "done", completed_at: patch.completedAt } : { status: "todo", completed_at: null })
      .eq("id", cur.data.assignment_id);
  }

  const rows = await s.supabase.from("todos").select("*").in("id", changedIds);
  if (rows.error) return dbError(rows.error);
  return { ok: true, changed: await withLabels(s, rows.data) };
}

export async function deleteTodo(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Attività non valida." };
  const s = await session();
  const del = await s.supabase.from("todos").delete().eq("id", id);
  return del.error ? dbError(del.error) : { ok: true };
}

const projectSchema = z.object({
  name: z.string().trim().min(1, "Scrivi un nome").max(60, "Massimo 60 caratteri"),
  color: z.number().int().min(1).max(8),
});

export async function createProject(input: { name: string; color: number }): Promise<ActionResult<{ project: TodoProject }>> {
  if (!isSupabaseConfigured()) return DEMO;
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const s = await session();
  const ins = await s.supabase.from("todo_projects").insert(parsed.data).select("*").single();
  if (ins.error) return dbError(ins.error);
  return { ok: true, project: projectFromRow(ins.data) };
}

export async function updateProject(id: string, input: { name: string; color: number }): Promise<ActionResult<{ project: TodoProject }>> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Lista non valida." };
  const parsed = projectSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const s = await session();
  const upd = await s.supabase.from("todo_projects").update(parsed.data).eq("id", id).select("*").maybeSingle();
  if (upd.error) return dbError(upd.error);
  if (!upd.data) return { ok: false, error: "Lista non trovata." };
  return { ok: true, project: projectFromRow(upd.data) };
}

/** Elimina la lista: le sue attività tornano nell'Inbox. */
export async function deleteProject(id: string): Promise<ActionResult> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!uuid.safeParse(id).success) return { ok: false, error: "Lista non valida." };
  const s = await session();
  const del = await s.supabase.from("todo_projects").delete().eq("id", id);
  return del.error ? dbError(del.error) : { ok: true };
}

const PRIORITY_BY_KIND = { test: 1, oral: 1, project: 2, homework: 3 } as const;

/** Trasforma un compito, una verifica o un'interrogazione di scuola in un'attività da fare. */
export async function importAssignment(assignmentId: string): Promise<ActionResult<{ todo: Todo }>> {
  if (!isSupabaseConfigured()) return DEMO;
  if (!uuid.safeParse(assignmentId).success) return { ok: false, error: "Compito non valido." };
  const s = await session();
  const a = await s.supabase.from("assignments").select("*").eq("id", assignmentId).maybeSingle();
  if (a.error) return dbError(a.error);
  if (!a.data) return { ok: false, error: "Compito non trovato." };
  const ins = await s.supabase
    .from("todos")
    .insert({
      title: a.data.title,
      notes: a.data.description,
      due_on: a.data.due_on,
      priority: PRIORITY_BY_KIND[a.data.kind],
      subject_id: a.data.subject_id,
      assignment_id: a.data.id,
      completed_at: a.data.status === "done" ? (a.data.completed_at ?? new Date().toISOString()) : null,
    })
    .select("*")
    .single();
  if (ins.error) return dbError(ins.error);
  return { ok: true, todo: todoFromRow(ins.data) };
}
