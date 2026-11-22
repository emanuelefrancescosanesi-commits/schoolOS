import "server-only";
import { buildDemoTodoData } from "@/lib/demo/todo-dataset";
import type { Subject } from "@/lib/domain/model";
import { todoFromRow, projectFromRow, labelFromRow } from "@/lib/todo/mappers";
import type { ImportableAssignment, Todo, TodoLabel, TodoProject } from "@/lib/todo/types";
import { createClient } from "@/lib/supabase/server";
import { type SchoolContext, getSchoolContext } from "./school-data";

export interface TodoPageData {
  todos: Todo[];
  projects: TodoProject[];
  labels: TodoLabel[];
  subjects: Subject[];
  importable: ImportableAssignment[];
  today: string;
  demo: boolean;
}

/** Aperte sempre; completate solo degli ultimi 30 giorni (la vista "Completati" non è un archivio). */
const COMPLETED_WINDOW_DAYS = 30;

export async function getTodoPageData(context?: SchoolContext): Promise<TodoPageData> {
  const { data, today } = context ?? (await getSchoolContext());
  const subjects = data.subjects;

  if (data.isDemo) return { ...buildDemoTodoData(today, subjects), subjects, today, demo: true };

  const supabase = await createClient();
  const since = new Date(Date.now() - COMPLETED_WINDOW_DAYS * 86_400_000).toISOString();
  const [open, done, projects, labels, links, assignments] = await Promise.all([
    supabase.from("todos").select("*").is("completed_at", null).order("created_at").limit(2000),
    supabase.from("todos").select("*").gte("completed_at", since).order("completed_at", { ascending: false }).limit(300),
    supabase.from("todo_projects").select("*").order("position").order("created_at"),
    supabase.from("todo_labels").select("*").order("name"),
    supabase.from("todo_label_links").select("todo_id, label_id").limit(10_000),
    supabase.from("assignments").select("id, title, subject_id, due_on, kind").eq("status", "todo").order("due_on").limit(100),
  ]);
  for (const r of [open, done, projects, labels, links, assignments]) {
    if (r.error) throw new Error(r.error.message);
  }

  const labelsByTodo = new Map<string, string[]>();
  for (const l of links.data ?? []) labelsByTodo.set(l.todo_id, [...(labelsByTodo.get(l.todo_id) ?? []), l.label_id]);

  const rows = [...open.data!, ...done.data!];
  const linked = new Set(rows.map((r) => r.assignment_id).filter((id): id is string => id !== null));
  return {
    todos: rows.map((r) => todoFromRow(r, labelsByTodo.get(r.id) ?? [])),
    projects: projects.data!.map(projectFromRow),
    labels: labels.data!.map(labelFromRow),
    subjects,
    importable: assignments
      .data!.filter((a) => !linked.has(a.id))
      .map((a) => ({ id: a.id, title: a.title, subjectId: a.subject_id, due: a.due_on, kind: a.kind })),
    today,
    demo: false,
  };
}
