import { type DateKey, diffDays } from "./dates";

export type TaskKind = "test" | "oral" | "homework" | "project";

export interface Task {
  id: string;
  title: string;
  subjectId: string;
  kind: TaskKind;
  due: DateKey;
  /** Stima dello studente, in minuti. */
  estimatedMinutes?: number;
  done: boolean;
}

export type Priority = "high" | "medium" | "low";

export interface PriorityContext {
  today: DateKey;
  /** Materie con media sotto la sufficienza: i loro impegni salgono di priorità. */
  weakSubjectIds?: ReadonlySet<string>;
}

const KIND_WEIGHT: Record<TaskKind, number> = {
  test: 3,
  oral: 2.5,
  project: 2,
  homework: 1,
};

/**
 * Punteggio di priorità deterministico (più alto = più urgente).
 *
 * Combina tre fattori, in quest'ordine di importanza:
 * 1. vicinanza della scadenza (le scadenze superate restano in cima);
 * 2. tipo di impegno (una verifica conta più di un compito);
 * 3. materia in difficoltà e carico stimato.
 */
export function priorityScore(task: Task, ctx: PriorityContext): number {
  if (task.done) return 0;
  const daysLeft = diffDays(ctx.today, task.due);
  const urgency = daysLeft < 0 ? 12 : 10 / (daysLeft + 1);
  const kind = KIND_WEIGHT[task.kind];
  const weak = ctx.weakSubjectIds?.has(task.subjectId) ? 1.5 : 0;
  const effort = Math.min((task.estimatedMinutes ?? 0) / 60, 3) * 0.5;
  return round2(urgency * kind + weak + effort);
}

export function priorityOf(task: Task, ctx: PriorityContext): Priority {
  const score = priorityScore(task, ctx);
  if (score >= 10) return "high";
  if (score >= 4) return "medium";
  return "low";
}

/** Impegni aperti ordinati per priorità, poi per scadenza, poi per titolo. */
export function sortByPriority(tasks: readonly Task[], ctx: PriorityContext): Task[] {
  return tasks
    .filter((t) => !t.done)
    .map((t) => ({ t, score: priorityScore(t, ctx) }))
    .sort((a, b) => b.score - a.score || a.t.due.localeCompare(b.t.due) || a.t.title.localeCompare(b.t.title))
    .map(({ t }) => t);
}

/** Verifiche e interrogazioni nei prossimi `days` giorni, oggi incluso, in ordine di data. */
export function upcomingAssessments(tasks: readonly Task[], today: DateKey, days: number): Task[] {
  return tasks
    .filter((t) => !t.done && (t.kind === "test" || t.kind === "oral"))
    .filter((t) => {
      const d = diffDays(today, t.due);
      return d >= 0 && d <= days;
    })
    .sort((a, b) => a.due.localeCompare(b.due));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
