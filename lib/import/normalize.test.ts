import { describe, expect, it } from "vitest";
import { DEFAULT_SCALE } from "@/lib/domain/grading";
import {
  type ExtractedGrade,
  type NormalizeContext,
  matchSubject,
  normalizeExtraction,
  parseImportDate,
} from "./normalize";

const subjects = [
  { id: "mat", name: "Matematica" },
  { id: "ita", name: "Italiano" },
  { id: "ing", name: "Inglese" },
  { id: "sto", name: "Storia" },
  { id: "arte", name: "Disegno e storia dell'arte" },
  { id: "mot", name: "Scienze motorie" },
  { id: "nat", name: "Scienze naturali" },
];

const schoolYear = { starts_on: "2026-09-14", ends_on: "2027-06-10" };
const ctx: NormalizeContext = {
  subjects,
  scale: DEFAULT_SCALE,
  existing: [],
  today: "2026-11-19",
  schoolYear,
};

const grade = (over: Partial<ExtractedGrade> = {}): ExtractedGrade => ({
  subject: "Matematica",
  value: "7",
  date: "2026-11-10",
  kind: "written",
  description: null,
  ...over,
});

describe("matchSubject", () => {
  it("ignora maiuscole, accenti e punteggiatura", () => {
    expect(matchSubject("MATEMATICA", subjects)?.id).toBe("mat");
    expect(matchSubject("Disegno e Storia dell’Arte", subjects)?.id).toBe("arte");
  });

  it("riconosce le abbreviazioni univoche", () => {
    expect(matchSubject("Mat.", subjects)?.id).toBe("mat");
    expect(matchSubject("Ital", subjects)?.id).toBe("ita");
  });

  it("non indovina quando l'abbreviazione è ambigua", () => {
    expect(matchSubject("Scienze", subjects)).toBeNull();
    expect(matchSubject("Stor", subjects)?.id).not.toBe("arte");
  });

  it("tollera piccoli errori di lettura", () => {
    expect(matchSubject("Matematlca", subjects)?.id).toBe("mat");
  });

  it("restituisce null per materie sconosciute o vuote", () => {
    expect(matchSubject("Chimica", subjects)).toBeNull();
    expect(matchSubject("   ", subjects)).toBeNull();
  });
});

describe("parseImportDate", () => {
  it("accetta ISO e formati italiani", () => {
    expect(parseImportDate("2026-11-10", ctx.today, schoolYear)).toBe("2026-11-10");
    expect(parseImportDate("10/11/2026", ctx.today, schoolYear)).toBe("2026-11-10");
    expect(parseImportDate("10-11-26", ctx.today, schoolYear)).toBe("2026-11-10");
    expect(parseImportDate("5.3.2027", ctx.today, schoolYear)).toBe("2027-03-05");
  });

  it("senza anno sceglie quello dell'anno scolastico", () => {
    expect(parseImportDate("14/10", ctx.today, schoolYear)).toBe("2026-10-14");
    expect(parseImportDate("15/03", ctx.today, schoolYear)).toBe("2027-03-15");
  });

  it("rifiuta date impossibili o testo", () => {
    expect(parseImportDate("31/02/2026", ctx.today, schoolYear)).toBeNull();
    expect(parseImportDate("ieri", ctx.today, schoolYear)).toBeNull();
    expect(parseImportDate(null, ctx.today, schoolYear)).toBeNull();
  });
});

describe("normalizeExtraction", () => {
  it("prepara una riga valida", () => {
    const [row] = normalizeExtraction([grade({ value: "7+", description: "  Equazioni " })], ctx);
    expect(row).toMatchObject({ status: "ready", subjectId: "mat", value: 7.25, date: "2026-11-10", issue: null });
    expect(row.description).toBe("Equazioni");
  });

  it("il tipo mancante diventa scritto", () => {
    const [row] = normalizeExtraction([grade({ kind: null })], ctx);
    expect(row.kind).toBe("written");
  });

  it("segna come non valide le righe che non sono voti", () => {
    const rows = normalizeExtraction([grade({ value: "Ass." }), grade({ value: "" }), grade({ value: "7/8" })], ctx);
    expect(rows.map((r) => r.status)).toEqual(["invalid", "invalid", "invalid"]);
  });

  it("rispetta la scala dello studente", () => {
    const strict = { ...ctx, scale: { ...DEFAULT_SCALE, allowHalf: false, allowPlusMinus: false } };
    const [half, whole] = normalizeExtraction([grade({ value: "6½" }), grade({ value: "6" })], strict);
    expect(half.status).toBe("invalid");
    expect(whole.status).toBe("ready");
  });

  it("segnala materia sconosciuta, data mancante e data futura", () => {
    const [a, b, c] = normalizeExtraction(
      [grade({ subject: "Chimica" }), grade({ date: null }), grade({ date: "2026-12-25" })],
      ctx,
    );
    expect(a).toMatchObject({ status: "invalid", subjectId: null, issue: "Scegli la materia" });
    expect(b.issue).toBe("Manca la data");
    expect(c.issue).toBe("La data è nel futuro");
  });

  it("riconosce i duplicati dei voti già salvati", () => {
    const withExisting = {
      ...ctx,
      existing: [{ subjectId: "mat", date: "2026-11-10", value: 7, kind: "written" as const }],
    };
    const [row] = normalizeExtraction([grade()], withExisting);
    expect(row.status).toBe("duplicate");
  });

  it("riconosce i duplicati dentro la stessa importazione, non tra tipi diversi", () => {
    const rows = normalizeExtraction([grade(), grade(), grade({ kind: "oral" })], ctx);
    expect(rows.map((r) => r.status)).toEqual(["ready", "duplicate", "ready"]);
  });

  it("non perde il nome originale della materia", () => {
    const [row] = normalizeExtraction([grade({ subject: "Chimica" })], ctx);
    expect(row.subjectGuess).toBe("Chimica");
  });
});
