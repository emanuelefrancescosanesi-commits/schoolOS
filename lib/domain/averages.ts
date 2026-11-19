import { type DateKey, addDays } from "./dates";
import { type GradingScale, ceilToStep } from "./grading";

export type AverageMethod = "arithmetic" | "weighted";

export type GradeKind = "written" | "oral" | "practical";

export interface Grade {
  id: string;
  subjectId: string;
  value: number;
  /** Peso del voto (es. 0,5 per un test breve). Ignorato con la media aritmetica. */
  weight: number;
  date: DateKey;
  kind: GradeKind;
  description?: string;
}

/** Media di un insieme di voti, o `null` se non ci sono voti utili. */
export function average(grades: readonly Pick<Grade, "value" | "weight">[], method: AverageMethod): number | null {
  if (grades.length === 0) return null;
  if (method === "arithmetic") {
    return grades.reduce((sum, g) => sum + g.value, 0) / grades.length;
  }
  const totalWeight = grades.reduce((sum, g) => sum + g.weight, 0);
  if (totalWeight <= 0) return null;
  return grades.reduce((sum, g) => sum + g.value * g.weight, 0) / totalWeight;
}

export interface SubjectAverage {
  subjectId: string;
  average: number;
  count: number;
}

/** Media per materia, nell'ordine in cui le materie compaiono in `subjectIds`. */
export function subjectAverages(
  grades: readonly Grade[],
  subjectIds: readonly string[],
  method: AverageMethod,
): SubjectAverage[] {
  const bySubject = groupBy(grades, (g) => g.subjectId);
  const result: SubjectAverage[] = [];
  for (const subjectId of subjectIds) {
    const list = bySubject.get(subjectId) ?? [];
    const avg = average(list, method);
    if (avg !== null) result.push({ subjectId, average: avg, count: list.length });
  }
  return result;
}

/**
 * Media generale come la calcola la scuola: media delle medie per materia,
 * così una materia con molti voti non pesa più delle altre.
 */
export function overallAverage(grades: readonly Grade[], method: AverageMethod): number | null {
  const subjectIds = [...new Set(grades.map((g) => g.subjectId))];
  const perSubject = subjectAverages(grades, subjectIds, method);
  if (perSubject.length === 0) return null;
  return perSubject.reduce((sum, s) => sum + s.average, 0) / perSubject.length;
}

export interface TrendPoint {
  date: DateKey;
  average: number;
}

/**
 * Andamento della media generale: un punto per ogni giorno con almeno un voto,
 * calcolato su tutti i voti fino a quel giorno incluso.
 */
export function overallTrend(grades: readonly Grade[], method: AverageMethod): TrendPoint[] {
  const sorted = [...grades].sort((a, b) => a.date.localeCompare(b.date));
  const dates = [...new Set(sorted.map((g) => g.date))];
  const points: TrendPoint[] = [];
  for (const date of dates) {
    const upTo = sorted.filter((g) => g.date <= date);
    const avg = overallAverage(upTo, method);
    if (avg !== null) points.push({ date, average: avg });
  }
  return points;
}

/** Variazione della media generale rispetto a `days` giorni prima di `today`. */
export function averageDelta(
  grades: readonly Grade[],
  method: AverageMethod,
  today: DateKey,
  days: number,
): number | null {
  const now = overallAverage(
    grades.filter((g) => g.date <= today),
    method,
  );
  const cutoff = addDays(today, -days);
  const before = overallAverage(
    grades.filter((g) => g.date <= cutoff),
    method,
  );
  if (now === null || before === null) return null;
  return now - before;
}

export type RequiredGrade =
  | { status: "reached" }
  | { status: "reachable"; value: number }
  | { status: "unreachable"; best: number };

/**
 * Il voto minimo da prendere nella prossima prova (di peso `nextWeight`) per
 * portare la media della materia ad almeno `target`.
 *
 * Arrotondato per eccesso al passo della scala: se serve 6,1 e la scala
 * ammette i mezzi voti, serve 6½.
 */
export function requiredGrade(
  grades: readonly Pick<Grade, "value" | "weight">[],
  target: number,
  scale: GradingScale,
  method: AverageMethod,
  nextWeight = 1,
): RequiredGrade {
  const current = average(grades, method);
  if (current !== null && current >= target) return { status: "reached" };

  const w = method === "arithmetic" ? 1 : nextWeight;
  const sumW = method === "arithmetic" ? grades.length : grades.reduce((s, g) => s + g.weight, 0);
  const sumWV =
    method === "arithmetic"
      ? grades.reduce((s, g) => s + g.value, 0)
      : grades.reduce((s, g) => s + g.value * g.weight, 0);

  const needed = (target * (sumW + w) - sumWV) / w;
  const value = Math.max(scale.min, ceilToStep(needed, scale));

  if (value > scale.max) {
    const best = (sumWV + scale.max * w) / (sumW + w);
    return { status: "unreachable", best };
  }
  return { status: "reachable", value };
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}
