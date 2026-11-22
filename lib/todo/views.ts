import { type DateKey, addDays, diffDays } from "@/lib/domain/dates";
import type { Todo, TodoView } from "./types";

/** Ordine: scadenza (senza scadenza in fondo), orario, priorità (p1 prima), posizione, creazione. */
export function compareTodos(a: Todo, b: Todo): number {
  if (a.due !== b.due) {
    if (!a.due) return 1;
    if (!b.due) return -1;
    return a.due < b.due ? -1 : 1;
  }
  const at = a.time ?? "99:99";
  const bt = b.time ?? "99:99";
  if (at !== bt) return at < bt ? -1 : 1;
  return a.priority - b.priority || a.position - b.position || a.createdAt.localeCompare(b.createdAt);
}

export const isOpen = (t: Todo) => t.completedAt === null;
export const isOverdue = (t: Todo, today: DateKey) => isOpen(t) && t.due !== null && t.due < today;

/** Attività che appartengono alla vista. Le sotto-attività contano come le altre (se hanno scadenza propria). */
export function filterView(todos: readonly Todo[], view: TodoView, today: DateKey): Todo[] {
  switch (view.type) {
    case "inbox":
      return todos.filter((t) => isOpen(t) && t.projectId === null && t.parentId === null);
    case "today":
      return todos.filter((t) => isOpen(t) && t.due !== null && t.due <= today).sort(compareTodos);
    case "upcoming":
      return todos.filter((t) => isOpen(t) && t.due !== null && t.due >= today).sort(compareTodos);
    case "project":
      return todos.filter((t) => isOpen(t) && t.projectId === view.id && t.parentId === null);
    case "label":
      return todos.filter((t) => isOpen(t) && t.labelIds.includes(view.id) && t.parentId === null);
    case "completed":
      return todos
        .filter((t) => !isOpen(t) && t.parentId === null)
        .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  }
}

export interface DayGroup {
  /** Nullo = "Senza data" (solo nelle viste per lista/etichetta). */
  date: DateKey | null;
  overdue?: boolean;
  items: Todo[];
}

/** Raggruppa "Prossimi": scaduti in cima, poi un gruppo per giorno nei prossimi `days` giorni, poi "più avanti". */
export function groupUpcoming(todos: readonly Todo[], today: DateKey, days = 14): { groups: DayGroup[]; later: Todo[] } {
  const open = todos.filter((t) => isOpen(t) && t.due !== null).sort(compareTodos);
  const groups: DayGroup[] = [];
  const overdue = open.filter((t) => t.due! < today);
  if (overdue.length) groups.push({ date: today, overdue: true, items: overdue });
  const byDay = new Map<DateKey, Todo[]>();
  const later: Todo[] = [];
  for (const t of open) {
    if (t.due! < today) continue;
    if (diffDays(today, t.due!) > days) later.push(t);
    else byDay.set(t.due!, [...(byDay.get(t.due!) ?? []), t]);
  }
  for (let i = 0; i <= days; i++) {
    const d = addDays(today, i);
    const items = byDay.get(d);
    if (items) groups.push({ date: d, items });
  }
  return { groups, later };
}

export interface TodoCounts {
  inbox: number;
  today: number;
  upcoming: number;
  byProject: Map<string, number>;
  byLabel: Map<string, number>;
}

/** Contatori dei badge: solo attività aperte; "Oggi" include gli scaduti. */
export function countTodos(todos: readonly Todo[], today: DateKey): TodoCounts {
  const counts: TodoCounts = { inbox: 0, today: 0, upcoming: 0, byProject: new Map(), byLabel: new Map() };
  for (const t of todos) {
    if (!isOpen(t)) continue;
    if (t.due !== null && t.due <= today) counts.today++;
    if (t.due !== null && t.due > today) counts.upcoming++;
    if (t.parentId !== null) continue;
    if (t.projectId === null) counts.inbox++;
    else counts.byProject.set(t.projectId, (counts.byProject.get(t.projectId) ?? 0) + 1);
    for (const l of t.labelIds) counts.byLabel.set(l, (counts.byLabel.get(l) ?? 0) + 1);
  }
  return counts;
}

export interface TodoNode {
  todo: Todo;
  children: Todo[];
  doneChildren: number;
}

/** Albero a due livelli per le viste per lista: sotto-attività sotto il genitore. */
export function buildTree(parents: readonly Todo[], all: readonly Todo[]): TodoNode[] {
  const childrenOf = new Map<string, Todo[]>();
  for (const t of all) {
    if (t.parentId) childrenOf.set(t.parentId, [...(childrenOf.get(t.parentId) ?? []), t]);
  }
  return parents.map((todo) => {
    const children = (childrenOf.get(todo.id) ?? []).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
    return { todo, children, doneChildren: children.filter((c) => !isOpen(c)).length };
  });
}

/** Ricerca per titolo, note e sotto-attività: ignora maiuscole e accenti. */
export function matchesQuery(todo: Todo, query: string): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  const q = norm(query.trim());
  if (!q) return true;
  return norm(todo.title).includes(q) || norm(todo.notes ?? "").includes(q);
}
