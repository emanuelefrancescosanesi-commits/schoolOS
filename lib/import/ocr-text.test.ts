import { describe, expect, it } from "vitest";
import { parseRegistroText } from "./parse-text";
import { cleanOcrText } from "./ocr-text";

describe("cleanOcrText", () => {
  it("corregge ½ letto come % o 1/2", () => {
    expect(cleanOcrText("28/10/2026 Orale 6% Funzioni")).toBe("28/10/2026 Orale 6½ Funzioni");
    expect(cleanOcrText("Orale 7 1/2 Funzioni")).toBe("Orale 7½ Funzioni");
  });

  it("toglie le barre spurie delle tabelle e normalizza i meno", () => {
    expect(cleanOcrText("21/10/2026 Orale | 8− Present perfect")).toBe("21/10/2026 Orale   8- Present perfect");
  });

  it("non tocca date né percentuali negli argomenti", () => {
    expect(cleanOcrText("14/10/2026 Scritto 7+")).toBe("14/10/2026 Scritto 7+");
    expect(cleanOcrText("Verifica sul 50% del programma")).toBe("Verifica sul 50% del programma");
  });

  it("l'output pulito passa dal parser", () => {
    const ocr = "MATEMATICA\n28/10/2026 Orale | 6% Funzioni\n11/11/2026 Scritto 5- Disequazioni";
    const rows = parseRegistroText(cleanOcrText(ocr), { subjectNames: ["Matematica"] });
    expect(rows.map((r) => r.value)).toEqual(["6½", "5-"]);
  });
});
