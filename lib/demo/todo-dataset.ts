import { addDays } from "@/lib/domain/dates";
import type { Subject } from "@/lib/domain/model";
import type { ImportableAssignment, Todo, TodoLabel, TodoProject } from "@/lib/todo/types";

/** Dati di esempio della lista "Da fare" per la modalità demo (si perdono ricaricando la pagina). */
export function buildDemoTodoData(
  today: string,
  subjects: readonly Subject[],
): { todos: Todo[]; projects: TodoProject[]; labels: TodoLabel[]; importable: ImportableAssignment[] } {
  const projects: TodoProject[] = [
    { id: "demo-p-scuola", name: "Scuola", color: 1, position: 0 },
    { id: "demo-p-sport", name: "Sport e hobby", color: 3, position: 1 },
  ];
  const labels: TodoLabel[] = [
    { id: "demo-l-ripasso", name: "ripasso" },
    { id: "demo-l-veloce", name: "veloce" },
  ];
  const base = { notes: null, parentId: null, time: null, priority: 4 as const, recurrence: null, assignmentId: null, completedAt: null, position: 0, createdAt: `${today}T08:00:00.000Z` };
  const subjectId = (i: number) => subjects[i]?.id ?? null;
  const todos: Todo[] = [
    { ...base, id: "demo-t1", title: "Ripassare il capitolo 4", projectId: "demo-p-scuola", due: today, priority: 1, subjectId: subjectId(0), labelIds: ["demo-l-ripasso"] },
    { ...base, id: "demo-t2", title: "Finire gli esercizi", projectId: "demo-p-scuola", due: today, time: "17:30", priority: 2, subjectId: subjectId(1), labelIds: [] },
    { ...base, id: "demo-t3", title: "Chiamare Marco per il progetto", projectId: null, due: addDays(today, 1), subjectId: null, labelIds: ["demo-l-veloce"] },
    { ...base, id: "demo-t4", title: "Allenamento", projectId: "demo-p-sport", due: addDays(today, 2), recurrence: { freq: "week", interval: 1, weekdays: [2, 4] }, subjectId: null, labelIds: [] },
    { ...base, id: "demo-t5", title: "Comprare il quaderno nuovo", projectId: null, due: null, subjectId: null, labelIds: [] },
    { ...base, id: "demo-t6", title: "Leggere i primi due paragrafi", parentId: "demo-t1", projectId: "demo-p-scuola", due: today, subjectId: subjectId(0), labelIds: [] },
  ];
  return { todos, projects, labels, importable: [] };
}
