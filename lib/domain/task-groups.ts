import { type DateKey, diffDays } from "./dates";
import { type PriorityContext, type Task, priorityScore } from "./tasks";

export type TaskGroupKey = "overdue" | "today" | "tomorrow" | "week" | "later";
export const TASK_GROUP_ORDER: readonly TaskGroupKey[] = ["overdue", "today", "tomorrow", "week", "later"];

export function groupKeyFor(due: DateKey, today: DateKey): TaskGroupKey {
  const d = diffDays(today, due);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d === 1) return "tomorrow";
  if (d <= 7) return "week";
  return "later";
}

/** Compiti aperti per fascia di scadenza; dentro la fascia, prima i più urgenti. Fasce vuote omesse. */
export function groupTasks(tasks: readonly Task[], ctx: PriorityContext): { key: TaskGroupKey; tasks: Task[] }[] {
  const buckets = new Map<TaskGroupKey, Task[]>();
  for (const t of tasks) {
    if (t.done) continue;
    const key = groupKeyFor(t.due, ctx.today);
    buckets.set(key, [...(buckets.get(key) ?? []), t]);
  }
  return TASK_GROUP_ORDER.filter((k) => buckets.has(k)).map((key) => ({
    key,
    tasks: buckets
      .get(key)!
      .sort((a, b) => a.due.localeCompare(b.due) || priorityScore(b, ctx) - priorityScore(a, ctx) || a.title.localeCompare(b.title)),
  }));
}
