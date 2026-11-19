import { describe, expect, it } from "vitest";
import { parseRegistroText } from "./parse-text";

// Testo prodotto da extension/generic.js (lettura generica) su un elenco e su una griglia:
// deve essere capito dal parser di SchoolOS senza passaggi in più.
const subjectNames = ["Matematica", "Italiano", "Storia dell'arte", "Inglese"];

describe("testo della lettura generica dell'estensione", () => {
  it("elenco «un voto per riga»", () => {
    const text = `Italiano
14/10/2026 Orale 8
05/11/2026 Scritto 4

Matematica
12/10/2026 Scritto 7½
20/10/2026 Orale 6+

Storia dell'arte
03/11/2026 Scritto 9,5`;
    const rows = parseRegistroText(text, { subjectNames });
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.date === "2026-10-12")).toMatchObject({ subject: "Matematica", value: "7½" });
    expect(rows.find((r) => r.date === "2026-11-03")).toMatchObject({ subject: "Storia dell'arte", value: "9,5" });
  });

  it("griglia date × materie senza tipo di prova", () => {
    const text = `Inglese
12/10/2026 9
19/10/2026 8

Italiano
19/10/2026 6+

Matematica
12/10/2026 7
03/11/2026 8,5`;
    const rows = parseRegistroText(text, { subjectNames });
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.subject === "Italiano")).toMatchObject({ date: "2026-10-19" });
  });
});
