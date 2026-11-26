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

import { averageTrend, goalStatus, gradeNeededOverTests, recoveryPlan, subjectPeriodMatrix } from "./analytics";
import { requiredGrade } from "./averages";
import { DEFAULT_SCALE } from "./grading";

const scale = DEFAULT_SCALE;

describe("recupero e obiettivi", () => {
  const four5 = [g("mat", 4, "2026-10-01"), g("mat", 5, "2026-10-10")]; // media 4,5

  it("con una prova coincide con requiredGrade", () => {
    const one = gradeNeededOverTests(four5, 6, scale, "arithmetic", 1);
    const base = requiredGrade(four5, 6, scale, "arithmetic");
    expect(one).toEqual(base);
  });

  it("serve meno voto se le prove sono di più", () => {
    const [a, b] = [1, 2].map((n) => gradeNeededOverTests(four5, 6, scale, "arithmetic", n));
    expect(a.status === "reachable" && b.status === "reachable" && b.value < a.value).toBe(true);
    // 2 prove: (6*4-9)/2 = 7,5
    expect(b).toEqual({ status: "reachable", value: 7.5 });
  });

  it("segnala quando non basta nemmeno il massimo", () => {
    const bad = [g("x", 2, "2026-10-01"), g("x", 2, "2026-10-02"), g("x", 2, "2026-10-03"), g("x", 2, "2026-10-04")];
    expect(gradeNeededOverTests(bad, 6, scale, "arithmetic", 1).status).toBe("unreachable");
    expect(gradeNeededOverTests(bad, 6, scale, "arithmetic", 4).status).toBe("reachable");
  });

  it("piano di recupero: solo materie insufficienti, dalla più grave", () => {
    const grades = [...four5, g("ita", 7, "2026-10-01"), g("sto", 5.5, "2026-10-01")];
    const plan = recoveryPlan(grades, scale, "arithmetic");
    expect(plan.map((p) => p.subjectId)).toEqual(["mat", "sto"]);
    expect(plan[0].options).toHaveLength(4);
  });

  it("stato obiettivo", () => {
    expect(goalStatus(four5, null, scale, "arithmetic").kind).toBe("none");
    expect(goalStatus([], 7, scale, "arithmetic").kind).toBe("none");
    expect(goalStatus(four5, 4, scale, "arithmetic")).toMatchObject({ kind: "reached" });
    expect(goalStatus(four5, 6, scale, "arithmetic")).toMatchObject({ kind: "missing", next: { status: "reachable" } });
  });

  it("andamento per materia e matrice per periodo", () => {
    const grades = [g("mat", 4, "2026-10-01"), g("mat", 8, "2026-10-10"), g("ita", 7, "2026-12-30")];
    expect(averageTrend(grades, "mat", "arithmetic")).toEqual([
      { date: "2026-10-01", average: 4 },
      { date: "2026-10-10", average: 6 },
    ]);
    expect(averageTrend(grades, null, "arithmetic")).toHaveLength(3);
    const periods = [
      { id: "p1", name: "T1", start: "2026-09-14", end: "2026-12-22" },
      { id: "p2", name: "T2", start: "2026-12-23", end: "2027-06-10" },
    ];
    const rows = subjectPeriodMatrix(grades, ["mat", "ita", "vuota"], periods, "arithmetic");
    expect(rows.map((r) => r.subjectId)).toEqual(["mat", "ita"]);
    expect(rows[0].perPeriod).toEqual([6, null]);
    expect(rows[1].perPeriod).toEqual([null, 7]);
  });
});
