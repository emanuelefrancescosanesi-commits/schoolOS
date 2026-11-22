import type { TodoLabelRow, TodoProjectRow, TodoRow } from "@/lib/supabase/database.types";
import { parseRecurrence } from "./recurrence";
import { type Todo, type TodoLabel, type TodoProject, isPriority } from "./types";

/** Conversioni pure dalle righe del database al modello del dominio. */

export function todoFromRow(row: TodoRow, labelIds: string[] = []): Todo {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    projectId: row.project_id,
    parentId: row.parent_id,
    due: row.due_on,
    // Postgres restituisce "HH:MM:SS": all'interfaccia basta "HH:MM".
    time: row.due_time ? row.due_time.slice(0, 5) : null,
    priority: isPriority(row.priority) ? row.priority : 4,
    recurrence: parseRecurrence(row.recurrence),
    subjectId: row.subject_id,
    assignmentId: row.assignment_id,
    labelIds,
    completedAt: row.completed_at,
    position: row.position,
    createdAt: row.created_at,
  };
}

export const projectFromRow = (row: TodoProjectRow): TodoProject => ({
  id: row.id,
  name: row.name,
  color: row.color,
  position: row.position,
});

export const labelFromRow = (row: TodoLabelRow): TodoLabel => ({ id: row.id, name: row.name });
