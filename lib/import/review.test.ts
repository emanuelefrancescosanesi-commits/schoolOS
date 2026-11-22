import { describe, expect, it } from "vitest";
import { DEFAULT_SCALE } from "@/lib/domain/grading";
import type { ImportRow } from "./normalize";
import { type Draft, rowProblem, selectRows, summarizeRows } from "./review";

const today = "2026-11-22";
const row = (over: Partial<Draft> = {}): Draft => ({
  key: "0",
  subjectGuess: "Matematica",
  subjectId: "m",
  valueText: "7½",
  value: 7.5,
  date: "2026-10-14",
  kind: "written",
  description: "",
  status: "ready",
  issue: null,
  selected: true,
  ...(over as Partial<ImportRow>),
});
const problem = (r: Draft) => rowProblem(r, DEFAULT_SCALE, today, (id) => id === "m");

describe("rowProblem", () => {
  it("riga valida", () => expect(problem(row())).toBeNull());
  it("materia mancante o sconosciuta", () => {
    expect(problem(row({ subjectId: null }))).toBe("Scegli la materia");
    expect(problem(row({ subjectId: "zzz" }))).toBe("Scegli la materia");
  });
  it("voto fuori scala o illeggibile (OCR)", () => {
    expect(problem(row({ valueText: "11" }))).toBe("Voto non valido per la tua scala");
    expect(problem(row({ valueText: "abc" }))).toBe("Voto non valido per la tua scala");
  });
  it("data mancante, inesistente o futura", () => {
    expect(problem(row({ date: null }))).toBe("Data non valida");
    expect(problem(row({ date: "2026-02-31" }))).toBe("Data non valida");
    expect(problem(row({ date: "2026-12-01" }))).toBe("La data è nel futuro");
  });
});

describe("summarizeRows / selectRows", () => {
  const rows = [row({ key: "1" }), row({ key: "2", status: "duplicate" }), row({ key: "3", valueText: "x" }), row({ key: "4", selected: false })];
  it("conta importabili, duplicati e da correggere", () => {
    expect(summarizeRows(rows, problem)).toEqual({ total: 4, importable: 2, duplicates: 1, toFix: 1 });
  });
  it("seleziona solo le nuove valide", () => {
    expect(selectRows(rows, problem, true).map((r) => r.selected)).toEqual([true, false, false, true]);
  });
  it("seleziona anche i duplicati su richiesta ma mai le righe da correggere", () => {
    expect(selectRows(rows, problem, false).map((r) => r.selected)).toEqual([true, true, false, true]);
  });
});
