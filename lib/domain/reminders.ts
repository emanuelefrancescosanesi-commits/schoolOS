import { type DateKey, diffDays } from "./dates";
import type { Task } from "./tasks";

export type ReminderType = "overdue" | "today" | "soon-test" | "tomorrow";

export interface Reminder {
  id: string;
  type: ReminderType;
  task: Task;
  /** Giorni a scadenza: negativo = scaduto. */
  days: number;
}

const ORDER: Record<ReminderType, number> = { overdue: 0, today: 1, "soon-test": 2, tomorrow: 3 };

/**
 * Promemoria calcolati sui dati dello studente (nessun invio esterno):
 * scaduti, in scadenza oggi, verifiche/interrogazioni nei prossimi 3 giorni, in scadenza domani.
 */
export function buildReminders(tasks: readonly Task[], today: DateKey): Reminder[] {
  const out: Reminder[] = [];
  for (const task of tasks) {
    if (task.done) continue;
    const days = diffDays(today, task.due);
    const graded = task.kind === "test" || task.kind === "oral";
    let type: ReminderType | null = null;
    if (days < 0) type = "overdue";
    else if (days === 0) type = "today";
    else if (graded && days <= 3) type = "soon-test";
    else if (days === 1) type = "tomorrow";
    if (type) out.push({ id: `${type}-${task.id}`, type, task, days });
  }
  return out.sort((a, b) => ORDER[a.type] - ORDER[b.type] || a.days - b.days || a.task.title.localeCompare(b.task.title));
}
