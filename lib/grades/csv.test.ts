import { describe, expect, it } from "vitest";
import type { Grade } from "@/lib/domain/averages";
import { DEFAULT_SCALE as scale } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";
import { gradesToCsv, sortGrades } from "./csv";

const subjects = [{ id: "s1", name: "Matematica" }] as Subject[];
const g = (over: Partial<Grade>): Grade => ({
  id: "a",
  subjectId: "s1",
  value: 7.5,
  weight: 1,
  date: "2026-10-14",
  kind: "written",
  ...over,
});

describe("gradesToCsv", () => {
  it("scrive intestazione, BOM e righe dal più recente", () => {
    const csv = gradesToCsv([g({ id: "1", date: "2026-10-01" }), g({ id: "2", date: "2026-11-01", weight: 0.5 })], subjects, scale);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines[0]).toBe("Data;Materia;Voto;Tipo;Peso;Argomento");
    expect(lines[1].startsWith("2026-11-01;Matematica;")).toBe(true);
    expect(lines[1]).toContain(";0,5;");
    expect(lines).toHaveLength(3);
  });

  it("racchiude tra virgolette e raddoppia le virgolette", () => {
    const csv = gradesToCsv([g({ description: 'Verifica "A"; parte 2' })], subjects, scale);
    expect(csv).toContain('"Verifica ""A""; parte 2"');
  });

  it("neutralizza le formule", () => {
    const csv = gradesToCsv([g({ description: "=HYPERLINK(\"x\")" })], subjects, scale);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/;=HYPERLINK/);
  });

  it("senza voti restituisce solo l'intestazione", () => {
    expect(gradesToCsv([], subjects, scale)).toBe("\uFEFFData;Materia;Voto;Tipo;Peso;Argomento\r\n");
  });
});

describe("sortGrades", () => {
  const list = [g({ id: "1", value: 6, date: "2026-10-01" }), g({ id: "2", value: 9, date: "2026-09-01" }), g({ id: "3", value: 9, date: "2026-11-01" })];
  it("per data decrescente", () => expect(sortGrades(list, "date").map((x) => x.id)).toEqual(["3", "1", "2"]));
  it("per voto decrescente, a parità la data più recente", () => expect(sortGrades(list, "value").map((x) => x.id)).toEqual(["3", "2", "1"]));
  it("non modifica l'originale", () => {
    const copy = [...list];
    sortGrades(list, "value");
    expect(list).toEqual(copy);
  });
});
