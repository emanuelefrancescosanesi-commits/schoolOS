import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCALE,
  type GradingScale,
  ceilToStep,
  formatAverage,
  formatGrade,
  gradeStanding,
  isAllowedGrade,
  parseGrade,
} from "./grading";

const noPlusMinus: GradingScale = { ...DEFAULT_SCALE, allowPlusMinus: false };
const wholeOnly: GradingScale = { ...DEFAULT_SCALE, allowHalf: false, allowPlusMinus: false };

describe("parseGrade", () => {
  it.each([
    ["7", 7],
    ["7.5", 7.5],
    ["7,5", 7.5],
    ["7½", 7.5],
    ["7 e mezzo", 7.5],
    ["7+", 7.25],
    ["7-", 6.75],
    ["7−", 6.75],
    ["  8 + ", 8.25],
    ["10", 10],
    ["1", 1],
  ])("interpreta %s come %d", (input, expected) => {
    expect(parseGrade(input)).toEqual({ ok: true, value: expected });
  });

  it("rifiuta input vuoti o malformati", () => {
    expect(parseGrade("  ")).toEqual({ ok: false, reason: "empty" });
    expect(parseGrade("sette")).toEqual({ ok: false, reason: "format" });
    expect(parseGrade("7++")).toEqual({ ok: false, reason: "format" });
    expect(parseGrade("6.5+")).toEqual({ ok: false, reason: "format" });
  });

  it("rifiuta voti fuori scala", () => {
    expect(parseGrade("10+")).toEqual({ ok: false, reason: "range" });
    expect(parseGrade("1-")).toEqual({ ok: false, reason: "range" });
    expect(parseGrade("11")).toEqual({ ok: false, reason: "range" });
  });

  it("rispetta le opzioni della scala", () => {
    expect(parseGrade("7+", noPlusMinus)).toEqual({ ok: false, reason: "step" });
    expect(parseGrade("7.5", wholeOnly)).toEqual({ ok: false, reason: "step" });
    expect(parseGrade("7.3")).toEqual({ ok: false, reason: "step" });
    expect(parseGrade("7", wholeOnly)).toEqual({ ok: true, value: 7 });
  });
});

describe("isAllowedGrade", () => {
  it("accetta i quarti solo con + e −", () => {
    expect(isAllowedGrade(6.75, DEFAULT_SCALE)).toBe(true);
    expect(isAllowedGrade(6.75, noPlusMinus)).toBe(false);
    expect(isAllowedGrade(6.5, noPlusMinus)).toBe(true);
    expect(isAllowedGrade(Number.NaN, DEFAULT_SCALE)).toBe(false);
  });
});

describe("formatGrade", () => {
  it.each([
    [7, "7"],
    [7.25, "7+"],
    [7.5, "7½"],
    [7.75, "8−"],
  ])("mostra %d come %s", (value, expected) => {
    expect(formatGrade(value)).toBe(expected);
  });

  it("senza + e − mostra i quarti in decimali", () => {
    expect(formatGrade(7.25, noPlusMinus)).toBe("7,25");
  });
});

describe("formatAverage", () => {
  it("usa due decimali e la virgola", () => {
    expect(formatAverage(6.666)).toBe("6,67");
    expect(formatAverage(7)).toBe("7,00");
  });
});

describe("gradeStanding", () => {
  it("distingue sufficienza, zona limite e insufficienza", () => {
    expect(gradeStanding(6)).toBe("positive");
    expect(gradeStanding(5.75)).toBe("borderline");
    expect(gradeStanding(5.5)).toBe("borderline");
    expect(gradeStanding(5.49)).toBe("critical");
  });
});

describe("ceilToStep", () => {
  it("arrotonda per eccesso al passo della scala", () => {
    expect(ceilToStep(6.1, DEFAULT_SCALE)).toBe(6.25);
    expect(ceilToStep(6.1, noPlusMinus)).toBe(6.5);
    expect(ceilToStep(6.1, wholeOnly)).toBe(7);
    expect(ceilToStep(6.5, noPlusMinus)).toBe(6.5);
  });
});
