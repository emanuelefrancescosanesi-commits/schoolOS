import { nextDue } from "./recurrence";
import type { Todo } from "./types";

/**
 * Cosa cambia quando si spunta (o si de-spunta) un'attività. Stessa funzione sul server (che
 * scrive nel database) e sul client (aggiornamento ottimistico), così non possono divergere.
 */
export type CompletionPatch =
  | { kind: "done"; completedAt: string }
  /** Ricorrente: non si chiude, la scadenza scorre in avanti. */
  | { kind: "rolled"; due: string }
  | { kind: "reopened" };

export function completionPatch(todo: Pick<Todo, "completedAt" | "due" | "recurrence">, today: string, now: Date): CompletionPatch {
  if (todo.completedAt) return { kind: "reopened" };
  if (todo.recurrence && todo.due) return { kind: "rolled", due: nextDue(todo.recurrence, todo.due, today) };
  return { kind: "done", completedAt: now.toISOString() };
}

export function applyCompletion<T extends Pick<Todo, "completedAt" | "due">>(todo: T, patch: CompletionPatch): T {
  if (patch.kind === "done") return { ...todo, completedAt: patch.completedAt };
  if (patch.kind === "rolled") return { ...todo, due: patch.due };
  return { ...todo, completedAt: null };
}
