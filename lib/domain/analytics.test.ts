import { describe, expect, it } from "vitest";
import { periodAverages, stdDev, subjectInsights } from "./analytics";
import type { Grade } from "./averages";

const g = (subjectId: string, value: number, date: string): Grade => ({ id: `${subjectId}${date}`, subjectId, value, weight: 1, date, kind: "oral" });

describe("analisi", () => {
  it("calcola la deviazione standard", () => {
    expect(stdDev([])).toBe(0);
    expect(stdDev([7])).toBe(0);
    expect(stdDev([6, 8])).toBe(1);
  });

  it("segnala le materie instabili e calcola l'andamento recente", () => {
    const grades = [
      g("mat", 4, "2026-10-01"), g("mat", 9, "2026-10-10"), g("mat", 5, "2026-10-20"), g("mat", 9, "2026-11-01"),
      g("ita", 7, "2026-10-01"), g("ita", 7, "2026-10-10"), g("ita", 8, "2026-10-20"), g("ita", 8, "2026-11-01"),
      g("sto", 6, "2026-10-01"),
    ];
    const res = subjectInsights(grades, "arithmetic");
    expect(res.map((r) => r.subjectId)).toEqual(["mat", "ita"]); // storia: un solo voto, esclusa
    expect(res[0].unstable).toBe(true);
    expect(res[1].unstable).toBe(false);
    // ita: ultimi 3 = (7+8+8)/3, precedenti = 7
    expect(res[1].momentum).toBeCloseTo(23 / 3 - 7);
  });

  it("senza almeno 4 voti l'andamento non c'è", () => {
    expect(subjectInsights([g("a", 6, "2026-10-01"), g("a", 7, "2026-10-02")], "arithmetic")[0].momentum).toBeNull();
  });

  it("confronta i periodi", () => {
    const periods = [
      { id: "p1", name: "T1", start: "2026-09-14", end: "2026-12-22" },
      { id: "p2", name: "T2", start: "2026-12-23", end: "2027-06-10" },
    ];
    const res = periodAverages([g("a", 6, "2026-10-01"), g("a", 8, "2026-12-22")], periods, "arithmetic");
    expect(res[0]).toMatchObject({ average: 7, count: 2 });
    expect(res[1]).toMatchObject({ average: null, count: 0 });
  });
});
