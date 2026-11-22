import { describe, expect, it } from "vitest";
import { monthGrid, shiftMonth, startOfMonth } from "./calendar";

describe("calendario", () => {
  it("startOfMonth e shiftMonth attraversano gli anni", () => {
    expect(startOfMonth("2026-11-22")).toBe("2026-11-01");
    expect(shiftMonth("2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-31", -1)).toBe("2025-12-01");
    expect(shiftMonth("2026-11-22", 0)).toBe("2026-11-01");
  });

  it("monthGrid: settimane da lunedì, copre tutto il mese", () => {
    const g = monthGrid("2026-11-22"); // novembre 2026 inizia di domenica
    expect(g[0][0]).toBe("2026-10-26");
    expect(g[0][6]).toBe("2026-11-01");
    expect(g.at(-1)!.includes("2026-11-30")).toBe(true);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(g).toHaveLength(6); // il 30 è lunedì: sesta riga
  });

  it("monthGrid: febbraio che inizia di lunedì ha 4 settimane complete; mesi lunghi fino a 6", () => {
    expect(monthGrid("2027-02-10")).toHaveLength(4);
    expect(monthGrid("2026-08-10")).toHaveLength(6); // agosto 2026 inizia di sabato
  });
});
