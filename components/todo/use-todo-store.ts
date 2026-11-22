"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type CreateTodoInput,
  type UpdateTodoPatch,
  createProject,
  createTodo,
  deleteProject,
  deleteTodo,
  importAssignment,
  toggleTodo,
  updateProject,
  updateTodo,
} from "@/app/(app)/tasks/actions";
import { completionPatch, applyCompletion } from "@/lib/todo/complete";
import { dueLabel } from "@/lib/todo/format";
import type { ImportableAssignment, Todo, TodoLabel, TodoProject } from "@/lib/todo/types";

export interface TodoStoreInit {
  todos: Todo[];
  projects: TodoProject[];
  labels: TodoLabel[];
  importable: ImportableAssignment[];
  today: string;
  demo: boolean;
}

export interface Notice {
  text: string;
  /** Annulla l'ultima azione, se possibile. */
  undo?: () => void;
}

export type NewTodoInput = Omit<CreateTodoInput, "title"> & { title: string };

const byId = <T extends { id: string }>(list: readonly T[], id: string) => list.find((i) => i.id === id);

/** Unisce le righe restituite dal server a quelle locali, per id. */
function merge(list: Todo[], rows: Todo[]): Todo[] {
  const map = new Map(rows.map((r) => [r.id, r]));
  return list.map((t) => map.get(t.id) ?? t);
}

/**
 * Stato client della lista "Da fare". Ogni azione si applica subito (ottimistico) e poi si
 * riallinea con il server; se il server rifiuta, torna com'era e mostra l'errore. In demo
 * non c'è server: tutto resta nella pagina.
 */
export function useTodoStore(init: TodoStoreInit) {
  const { today, demo } = init;
  const [todos, setTodos] = useState(init.todos);
  const [projects, setProjects] = useState(init.projects);
  const [labels, setLabels] = useState(init.labels);
  const [importable, setImportable] = useState(init.importable);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const latest = useRef({ todos, projects, labels });
  useEffect(() => {
    latest.current = { todos, projects, labels };
  });
  const toggleRef = useRef<(id: string) => Promise<void>>(async () => {});
  const counter = useRef(0);
  const newId = (prefix: string) => `${demo ? "demo" : "tmp"}-${prefix}-${++counter.current}`;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const fail = useCallback((message: string) => setError(message === "demo" ? "Disponibile con un account." : message), []);
  const dismissError = useCallback(() => setError(null), []);

  /** Nomi di etichetta → id; quelle nuove nascono subito (provvisorie finché il server non risponde). */
  const labelIdsFor = (names: string[]): string[] => {
    const known = [...latest.current.labels];
    const ids: string[] = [];
    const created: TodoLabel[] = [];
    for (const name of names) {
      let label = known.find((l) => l.name.toLowerCase() === name.toLowerCase());
      if (!label) {
        label = { id: newId("l"), name };
        known.push(label);
        created.push(label);
      }
      ids.push(label.id);
    }
    if (created.length) setLabels((prev) => [...prev, ...created]);
    return ids;
  };

  const mergeLabels = (resolved: TodoLabel[]) =>
    setLabels((prev) => {
      const real = new Map(resolved.map((l) => [l.id, l]));
      const names = new Set(resolved.map((l) => l.name.toLowerCase()));
      // Via le provvisorie sostituite da quelle vere; le altre provvisorie in volo restano.
      const kept = prev.filter((l) => !real.has(l.id) && !(l.id.startsWith("tmp-") && names.has(l.name.toLowerCase())));
      return [...kept, ...resolved];
    });

  const addTodo = useCallback(
    async (input: NewTodoInput): Promise<boolean> => {
      const rule = input.recurrence ?? null;
      const due = input.due ?? null;
      const temp: Todo = {
        id: newId("t"),
        title: input.title.trim(),
        notes: input.notes ?? null,
        projectId: input.projectId ?? null,
        parentId: input.parentId ?? null,
        due,
        time: due ? (input.time ?? null) : null,
        priority: (input.priority ?? 4) as Todo["priority"],
        recurrence: due && !input.parentId ? rule : null,
        subjectId: input.subjectId ?? null,
        assignmentId: input.assignmentId ?? null,
        labelIds: labelIdsFor(input.labels ?? []),
        completedAt: null,
        position: 0,
        createdAt: new Date().toISOString(),
      };
      if (temp.parentId) {
        const parent = byId(latest.current.todos, temp.parentId);
        temp.projectId = parent?.projectId ?? null;
      }
      setTodos((prev) => [...prev, temp]);
      if (demo) return true;

      const res = await createTodo({ ...input, recurrence: input.recurrence ?? null });
      if (!res.ok) {
        setTodos((prev) => prev.filter((t) => t.id !== temp.id));
        fail(res.error);
        return false;
      }
      mergeLabels(res.labels);
      setTodos((prev) => prev.map((t) => (t.id === temp.id ? res.todo : t)));
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo, fail],
  );

  const toggle = useCallback(
    async (id: string) => {
      const current = byId(latest.current.todos, id);
      if (!current) return;
      const patch = completionPatch(current, today, new Date());
      const children = latest.current.todos.filter((t) => t.parentId === id);
      const before = [current, ...children];

      setTodos((prev) =>
        prev.map((t) => {
          if (t.id === id) return applyCompletion(t, patch);
          if (patch.kind === "done" && t.parentId === id && t.completedAt === null) return applyCompletion(t, patch);
          return t;
        }),
      );
      if (patch.kind === "done") setNotice({ text: "Completata", undo: () => void toggleRef.current(id) });
      else if (patch.kind === "rolled") {
        setNotice({ text: `Ripianificata: ${dueLabel(patch.due, current.time, today).text.toLowerCase()}` });
      } else setNotice(null);

      if (demo) return;
      const res = await toggleTodo(id);
      if (!res.ok) {
        setTodos((prev) => merge(prev, before));
        setNotice(null);
        fail(res.error);
        return;
      }
      setTodos((prev) => merge(prev, res.changed));
    },
    [demo, fail, today],
  );

  useEffect(() => {
    toggleRef.current = toggle;
  }, [toggle]);

  const update = useCallback(
    async (id: string, patch: UpdateTodoPatch) => {
      const current = byId(latest.current.todos, id);
      if (!current) return;
      const before = [current, ...latest.current.todos.filter((t) => t.parentId === id)];

      const next: Todo = { ...current };
      if (patch.title !== undefined) next.title = patch.title.trim() || current.title;
      if (patch.notes !== undefined) next.notes = patch.notes && patch.notes.trim() ? patch.notes : null;
      if (patch.priority !== undefined) next.priority = patch.priority as Todo["priority"];
      if (patch.projectId !== undefined) next.projectId = patch.projectId;
      if (patch.subjectId !== undefined) next.subjectId = patch.subjectId;
      if (patch.due !== undefined) {
        next.due = patch.due;
        if (patch.due === null) {
          next.time = null;
          next.recurrence = null;
        }
      }
      if (patch.time !== undefined && next.due) next.time = patch.time;
      if (patch.recurrence !== undefined && next.due && !next.parentId) next.recurrence = patch.recurrence as Todo["recurrence"];
      if (patch.labels !== undefined) next.labelIds = labelIdsFor(patch.labels);

      setTodos((prev) =>
        prev.map((t) => {
          if (t.id === id) return next;
          // Le sotto-attività seguono la lista del genitore.
          if (t.parentId === id && patch.projectId !== undefined) return { ...t, projectId: next.projectId };
          return t;
        }),
      );
      if (demo) return;

      const res = await updateTodo(id, { ...patch, title: patch.title?.trim() || undefined });
      if (!res.ok) {
        setTodos((prev) => merge(prev, before));
        fail(res.error);
        return;
      }
      mergeLabels(res.labels);
      setTodos((prev) => merge(prev, [res.todo, ...res.children]));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo, fail],
  );

  const remove = useCallback(
    async (id: string) => {
      const removed = latest.current.todos.filter((t) => t.id === id || t.parentId === id);
      setTodos((prev) => prev.filter((t) => t.id !== id && t.parentId !== id));
      if (demo) return;
      const res = await deleteTodo(id);
      if (!res.ok) {
        setTodos((prev) => [...prev, ...removed]);
        fail(res.error);
      }
    },
    [demo, fail],
  );

  const addProject = useCallback(
    async (name: string, color: number): Promise<TodoProject | null> => {
      const temp: TodoProject = { id: newId("p"), name: name.trim(), color, position: latest.current.projects.length };
      setProjects((prev) => [...prev, temp]);
      if (demo) return temp;
      const res = await createProject({ name, color });
      if (!res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== temp.id));
        fail(res.error);
        return null;
      }
      setProjects((prev) => prev.map((p) => (p.id === temp.id ? res.project : p)));
      return res.project;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo, fail],
  );

  const editProject = useCallback(
    async (id: string, name: string, color: number) => {
      const before = byId(latest.current.projects, id);
      if (!before) return;
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: name.trim(), color } : p)));
      if (demo) return;
      const res = await updateProject(id, { name, color });
      if (!res.ok) {
        setProjects((prev) => prev.map((p) => (p.id === id ? before : p)));
        fail(res.error);
        return;
      }
      setProjects((prev) => prev.map((p) => (p.id === id ? res.project : p)));
    },
    [demo, fail],
  );

  const removeProject = useCallback(
    async (id: string) => {
      const before = byId(latest.current.projects, id);
      const moved = latest.current.todos.filter((t) => t.projectId === id).map((t) => t.id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
      setTodos((prev) => prev.map((t) => (t.projectId === id ? { ...t, projectId: null } : t)));
      if (demo) return;
      const res = await deleteProject(id);
      if (!res.ok && before) {
        setProjects((prev) => [...prev, before]);
        setTodos((prev) => prev.map((t) => (moved.includes(t.id) ? { ...t, projectId: id } : t)));
        fail(res.error);
      }
    },
    [demo, fail],
  );

  const importOne = useCallback(
    async (a: ImportableAssignment) => {
      setImportable((prev) => prev.filter((i) => i.id !== a.id));
      const priority = a.kind === "test" || a.kind === "oral" ? 1 : a.kind === "project" ? 2 : 3;
      const temp: Todo = {
        id: newId("t"), title: a.title, notes: null, projectId: null, parentId: null, due: a.due, time: null,
        priority, recurrence: null, subjectId: a.subjectId, assignmentId: a.id, labelIds: [], completedAt: null,
        position: 0, createdAt: new Date().toISOString(),
      };
      setTodos((prev) => [...prev, temp]);
      if (demo) return;
      const res = await importAssignment(a.id);
      if (!res.ok) {
        setTodos((prev) => prev.filter((t) => t.id !== temp.id));
        setImportable((prev) => [...prev, a]);
        fail(res.error);
        return;
      }
      setTodos((prev) => prev.map((t) => (t.id === temp.id ? res.todo : t)));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [demo, fail],
  );

  return {
    todos, projects, labels, importable, error, notice,
    dismissError, dismissNotice: () => setNotice(null),
    addTodo, toggle, update, remove, addProject, editProject, removeProject, importOne,
  };
}
