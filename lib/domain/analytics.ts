import { type AverageMethod, type Grade, average, overallAverage } from "./averages";
import type { DateKey } from "./dates";
import { type GradingScale, ceilToStep } from "./grading";
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

export interface SubjectTrendPoint {
  date: DateKey;
  average: number;
}

/** Andamento della media di una materia (o della media generale con `subjectId` nullo): un punto per giorno con voti. */
export function averageTrend(grades: readonly Grade[], subjectId: string | null, method: AverageMethod): SubjectTrendPoint[] {
  const scoped = subjectId === null ? [...grades] : grades.filter((g) => g.subjectId === subjectId);
  scoped.sort(byDate);
  const dates = [...new Set(scoped.map((g) => g.date))];
  const out: SubjectTrendPoint[] = [];
  for (const date of dates) {
    const upTo = scoped.filter((g) => g.date <= date);
    const avg = subjectId === null ? overallAverage(upTo, method) : average(upTo, method);
    if (avg !== null) out.push({ date, average: avg });
  }
  return out;
}

export interface SubjectPeriodRow {
  subjectId: string;
  /** Media in ciascun periodo, nello stesso ordine di `periods` (null = nessun voto). */
  perPeriod: (number | null)[];
  overall: number | null;
}

/** Tabella materia × periodo: dove la media sale o scende da un periodo all'altro. */
export function subjectPeriodMatrix(
  grades: readonly Grade[],
  subjectIds: readonly string[],
  periods: readonly Period[],
  method: AverageMethod,
): SubjectPeriodRow[] {
  return subjectIds
    .map((subjectId) => {
      const own = grades.filter((g) => g.subjectId === subjectId);
      return {
        subjectId,
        perPeriod: periods.map((p) => average(own.filter((g) => g.date >= p.start && g.date <= p.end), method)),
        overall: average(own, method),
      };
    })
    .filter((row) => row.overall !== null);
}

export type TestsNeeded =
  | { status: "reached" }
  | { status: "reachable"; value: number }
  | { status: "unreachable"; best: number };

/**
 * Il voto che serve, preso uguale in `tests` prove future (ciascuna di peso `weight`),
 * per portare la media della materia ad almeno `target`. Con una sola prova coincide con `requiredGrade`.
 */
export function gradeNeededOverTests(
  grades: readonly Pick<Grade, "value" | "weight">[],
  target: number,
  scale: GradingScale,
  method: AverageMethod,
  tests: number,
  weight = 1,
): TestsNeeded {
  const current = average(grades, method);
  if (current !== null && current >= target) return { status: "reached" };
  const w = method === "arithmetic" ? 1 : weight;
  const sumW = method === "arithmetic" ? grades.length : grades.reduce((s, g) => s + g.weight, 0);
  const sumWV =
    method === "arithmetic" ? grades.reduce((s, g) => s + g.value, 0) : grades.reduce((s, g) => s + g.value * g.weight, 0);
  const totalNewW = w * tests;
  const needed = (target * (sumW + totalNewW) - sumWV) / totalNewW;
  const value = Math.max(scale.min, ceilToStep(needed, scale));
  if (value > scale.max) return { status: "unreachable", best: (sumWV + scale.max * totalNewW) / (sumW + totalNewW) };
  return { status: "reachable", value };
}

export interface RecoveryOption {
  tests: number;
  needed: TestsNeeded;
}

export interface RecoverySubject {
  subjectId: string;
  average: number;
  count: number;
  /** Distanza dalla sufficienza (positiva = sotto). */
  gap: number;
  options: RecoveryOption[];
}

export const RECOVERY_MAX_TESTS = 4;

/** Materie sotto la sufficienza, dalla più grave, con il voto che serve se si fanno 1…4 prove. */
export function recoveryPlan(grades: readonly Grade[], scale: GradingScale, method: AverageMethod): RecoverySubject[] {
  const ids = [...new Set(grades.map((g) => g.subjectId))];
  const out: RecoverySubject[] = [];
  for (const subjectId of ids) {
    const own = grades.filter((g) => g.subjectId === subjectId);
    const avg = average(own, method);
    if (avg === null || avg >= scale.passThreshold) continue;
    const options = Array.from({ length: RECOVERY_MAX_TESTS }, (_, i) => ({
      tests: i + 1,
      needed: gradeNeededOverTests(own, scale.passThreshold, scale, method, i + 1),
    }));
    out.push({ subjectId, average: avg, count: own.length, gap: scale.passThreshold - avg, options });
  }
  return out.sort((a, b) => b.gap - a.gap);
}

export type GoalStatus =
  | { kind: "none" }
  | { kind: "reached"; margin: number }
  | { kind: "missing"; gap: number; next: TestsNeeded };

/** Stato di un obiettivo di media: raggiunto (con margine) o quanto manca e cosa serve alla prossima prova. */
export function goalStatus(
  grades: readonly Pick<Grade, "value" | "weight">[],
  target: number | null,
  scale: GradingScale,
  method: AverageMethod,
  nextWeight = 1,
): GoalStatus {
  const avg = average(grades, method);
  if (target === null || avg === null) return { kind: "none" };
  if (avg >= target) return { kind: "reached", margin: avg - target };
  return { kind: "missing", gap: target - avg, next: gradeNeededOverTests(grades, target, scale, method, 1, nextWeight) };
}
