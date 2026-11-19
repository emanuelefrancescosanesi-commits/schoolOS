import { describe, expect, it } from "vitest";
import {
  type Grade,
  average,
  averageDelta,
  overallAverage,
  overallTrend,
  requiredGrade,
  subjectAverages,
} from "./averages";
import { DEFAULT_SCALE, type GradingScale } from "./grading";

let seq = 0;
function g(subjectId: string, value: number, date: string, weight = 1): Grade {
  return { id: `g${++seq}`, subjectId, value, weight, date, kind: "written" };
}

describe("average", () => {
  it("restituisce null senza voti", () => {
    expect(average([], "arithmetic")).toBeNull();
    expect(average([], "weighted")).toBeNull();
  });

  it("calcola la media aritmetica ignorando i pesi", () => {
    expect(average([g("mat", 6, "2026-10-01", 0.5), g("mat", 8, "2026-10-02", 2)], "arithmetic")).toBe(7);
  });

  it("calcola la media pesata", () => {
    // (6·1 + 9·2) / 3 = 8
    expect(average([g("mat", 6, "2026-10-01", 1), g("mat", 9, "2026-10-02", 2)], "weighted")).toBe(8);
  });

  it("con pesi tutti a zero la media pesata non è definita", () => {
    expect(average([g("mat", 6, "2026-10-01", 0)], "weighted")).toBeNull();
  });
});

describe("subjectAverages e overallAverage", () => {
  const grades = [
    g("ita", 6, "2026-10-01"),
    g("ita", 8, "2026-10-08"),
    g("mat", 4, "2026-10-02"),
    g("mat", 5, "2026-10-09"),
    g("mat", 6, "2026-10-16"),
  ];

  it("mantiene l'ordine delle materie e salta quelle senza voti", () => {
    expect(subjectAverages(grades, ["mat", "ing", "ita"], "arithmetic")).toEqual([
      { subjectId: "mat", average: 5, count: 3 },
      { subjectId: "ita", average: 7, count: 2 },
    ]);
  });

  it("la media generale è la media delle medie per materia", () => {
    // (7 + 5) / 2 = 6, non (6+8+4+5+6)/5 = 5,8
    expect(overallAverage(grades, "arithmetic")).toBe(6);
    expect(overallAverage([], "arithmetic")).toBeNull();
  });
});

describe("overallTrend e averageDelta", () => {
  const grades = [g("ita", 6, "2026-10-01"), g("mat", 8, "2026-10-01"), g("ita", 8, "2026-11-01")];

  it("produce un punto cumulativo per giorno", () => {
    expect(overallTrend(grades, "arithmetic")).toEqual([
      { date: "2026-10-01", average: 7 },
      { date: "2026-11-01", average: 7.5 },
    ]);
  });

  it("confronta con la media di N giorni prima", () => {
    expect(averageDelta(grades, "arithmetic", "2026-11-10", 30)).toBeCloseTo(0.5);
    expect(averageDelta(grades, "arithmetic", "2026-10-05", 30)).toBeNull();
  });
});

describe("requiredGrade", () => {
  const scale = DEFAULT_SCALE;

  it("segnala quando l'obiettivo è già raggiunto", () => {
    expect(requiredGrade([{ value: 7, weight: 1 }], 6, scale, "arithmetic")).toEqual({ status: "reached" });
  });

  it("calcola il voto necessario arrotondato al passo della scala", () => {
    // (5 + 5 + x) / 3 >= 6 → x >= 8
    expect(requiredGrade([{ value: 5, weight: 1 }, { value: 5, weight: 1 }], 6, scale, "arithmetic")).toEqual({
      status: "reachable",
      value: 8,
    });
    // (5 + x) / 2 >= 5,6 → x >= 6,2 → 6+ (6,25)
    expect(requiredGrade([{ value: 5, weight: 1 }], 5.6, scale, "arithmetic")).toEqual({
      status: "reachable",
      value: 6.25,
    });
  });

  it("senza + e − arrotonda al mezzo voto", () => {
    const halfOnly: GradingScale = { ...scale, allowPlusMinus: false };
    expect(requiredGrade([{ value: 5, weight: 1 }], 5.6, halfOnly, "arithmetic")).toEqual({
      status: "reachable",
      value: 6.5,
    });
  });

  it("tiene conto del peso della prossima prova", () => {
    // (4·1 + x·2) / 3 >= 6 → x >= 7
    expect(requiredGrade([{ value: 4, weight: 1 }], 6, scale, "weighted", 2)).toEqual({
      status: "reachable",
      value: 7,
    });
  });

  it("dice quando l'obiettivo non è raggiungibile con una sola prova", () => {
    const result = requiredGrade([{ value: 2, weight: 1 }, { value: 2, weight: 1 }], 6, scale, "arithmetic");
    expect(result.status).toBe("unreachable");
    if (result.status === "unreachable") expect(result.best).toBeCloseTo(14 / 3);
  });

  it("senza voti basta prendere il voto obiettivo", () => {
    expect(requiredGrade([], 6, scale, "arithmetic")).toEqual({ status: "reachable", value: 6 });
  });
});
