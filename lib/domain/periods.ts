import { type DateKey, isWithin } from "./dates";

export type PeriodScheme = "trimestri" | "trimestre-pentamestre" | "quadrimestri";

export interface Period {
  id: string;
  name: string;
  start: DateKey;
  end: DateKey;
}

/**
 * Periodi proposti in onboarding per l'anno scolastico che inizia a settembre
 * di `startYear`. Sono solo un punto di partenza: le date reali variano per
 * regione e istituto, e lo studente le corregge nel setup.
 */
export function suggestedPeriods(scheme: PeriodScheme, startYear: number): Period[] {
  const y = startYear;
  const n = y + 1;
  switch (scheme) {
    case "trimestri":
      return [
        { id: "p1", name: "Primo trimestre", start: `${y}-09-10`, end: `${y}-12-22` },
        { id: "p2", name: "Secondo trimestre", start: `${n}-01-07`, end: `${n}-03-31` },
        { id: "p3", name: "Terzo trimestre", start: `${n}-04-01`, end: `${n}-06-10` },
      ];
    case "trimestre-pentamestre":
      return [
        { id: "p1", name: "Trimestre", start: `${y}-09-10`, end: `${y}-12-22` },
        { id: "p2", name: "Pentamestre", start: `${n}-01-07`, end: `${n}-06-10` },
      ];
    case "quadrimestri":
      return [
        { id: "p1", name: "Primo quadrimestre", start: `${y}-09-10`, end: `${n}-01-31` },
        { id: "p2", name: "Secondo quadrimestre", start: `${n}-02-01`, end: `${n}-06-10` },
      ];
  }
}

/**
 * Il periodo che contiene `today`. Nelle vacanze tra due periodi restituisce
 * il più recente già iniziato; prima dell'inizio dell'anno, il primo.
 */
export function currentPeriod(periods: readonly Period[], today: DateKey): Period | null {
  if (periods.length === 0) return null;
  const sorted = [...periods].sort((a, b) => a.start.localeCompare(b.start));
  const inside = sorted.find((p) => isWithin(today, p.start, p.end));
  if (inside) return inside;
  const started = sorted.filter((p) => p.start <= today);
  return started.at(-1) ?? sorted[0];
}
