import { type AverageMethod, type Grade, average, overallAverage } from "./averages";
import type { Period } from "./periods";

export interface SubjectInsight {
  subjectId: string;
  count: number;
  average: number;
  /** Deviazione standard dei voti: alta = andamento altalenante. */
  spread: number;
  /** Media degli ultimi 3 voti meno la media dei precedenti (null con meno di 4 voti). */
  momentum: number | null;
  unstable: boolean;
}

/** Oltre questa deviazione standard (in punti voto) una materia è "instabile". */
export const UNSTABLE_SPREAD = 1.2;

const byDate = (a: Grade, b: Grade) => a.date.localeCompare(b.date);

export function stdDev(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
}

/** Una riga per materia con almeno 2 voti, dalla più instabile alla più stabile. */
export function subjectInsights(grades: readonly Grade[], method: AverageMethod): SubjectInsight[] {
  const groups = new Map<string, Grade[]>();
  for (const g of grades) groups.set(g.subjectId, [...(groups.get(g.subjectId) ?? []), g]);
  const out: SubjectInsight[] = [];
  for (const [subjectId, list] of groups) {
    const avg = average(list, method);
    if (avg === null || list.length < 2) continue;
    const sorted = [...list].sort(byDate);
    const spread = stdDev(sorted.map((g) => g.value));
    let momentum: number | null = null;
    if (sorted.length >= 4) {
      const recent = average(sorted.slice(-3), method);
      const before = average(sorted.slice(0, -3), method);
      if (recent !== null && before !== null) momentum = recent - before;
    }
    out.push({ subjectId, count: list.length, average: avg, spread, momentum, unstable: spread >= UNSTABLE_SPREAD });
  }
  return out.sort((a, b) => b.spread - a.spread);
}

export interface PeriodAverage {
  period: Period;
  average: number | null;
  count: number;
}

/** Media generale in ciascun periodo (voti con data dentro il periodo, estremi inclusi). */
export function periodAverages(grades: readonly Grade[], periods: readonly Period[], method: AverageMethod): PeriodAverage[] {
  return periods.map((period) => {
    const inPeriod = grades.filter((g) => g.date >= period.start && g.date <= period.end);
    return { period, average: overallAverage(inPeriod, method), count: inPeriod.length };
  });
}
