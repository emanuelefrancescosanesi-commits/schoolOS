import { type DateKey, isDateKey } from "@/lib/domain/dates";
import { type GradingScale, parseGrade } from "@/lib/domain/grading";

/**
 * Trasforma ciò che l'AI ha letto da un registro (testo o screenshot) in righe pronte da
 * confermare. Qui non c'è AI: è codice deterministico e testato. L'AI propone, questo codice
 * decide cosa è importabile, e lo studente conferma comunque ogni riga prima del salvataggio.
 */

export type GradeKind = "written" | "oral" | "practical";

/** Un voto come l'ha letto il modello, ancora grezzo. */
export interface ExtractedGrade {
  subject: string;
  /** Il voto come appare nel registro: "7+", "6½", "8,5". */
  value: string;
  /** "2026-10-14", "14/10/2026" o "14/10". Null se non leggibile. */
  date: string | null;
  kind: GradeKind | null;
  description: string | null;
}

export interface ImportSubject {
  id: string;
  name: string;
}

export interface ExistingGrade {
  subjectId: string;
  date: DateKey;
  value: number;
  kind: GradeKind;
}

export type RowStatus = "ready" | "duplicate" | "invalid";

export interface ImportRow {
  /** Chiave stabile dentro la bozza (indice nell'estrazione). */
  key: string;
  subjectGuess: string;
  subjectId: string | null;
  valueText: string;
  value: number | null;
  date: DateKey | null;
  kind: GradeKind;
  description: string;
  status: RowStatus;
  /** Motivo per cui la riga non è importabile o richiede attenzione. */
  issue: string | null;
}

export interface NormalizeContext {
  subjects: ImportSubject[];
  scale: GradingScale;
  existing: ExistingGrade[];
  today: DateKey;
  /** Anno scolastico, per capire a che anno appartiene una data scritta "14/10". */
  schoolYear: { starts_on: DateKey; ends_on: DateKey } | null;
}

// ─── Materie ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set(["e", "di", "del", "della", "dello", "dei", "delle", "il", "la", "lo", "l", "ed", "a"]);

/** Minuscolo, senza accenti né punteggiatura: "Storia dell'Arte" → "storia dell arte". */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(name: string): string[] {
  return normalizeName(name)
    .split(" ")
    .filter((t) => t && !STOP_WORDS.has(t));
}

function bigrams(s: string): string[] {
  const padded = ` ${s} `;
  const out: string[] = [];
  for (let i = 0; i < padded.length - 1; i++) out.push(padded.slice(i, i + 2));
  return out;
}

/** Somiglianza di Dice sui bigrammi, da 0 a 1. */
export function similarity(a: string, b: string): number {
  const x = bigrams(normalizeName(a));
  const y = bigrams(normalizeName(b));
  if (!x.length || !y.length) return 0;
  const counts = new Map<string, number>();
  for (const g of x) counts.set(g, (counts.get(g) ?? 0) + 1);
  let overlap = 0;
  for (const g of y) {
    const c = counts.get(g) ?? 0;
    if (c > 0) {
      overlap++;
      counts.set(g, c - 1);
    }
  }
  return (2 * overlap) / (x.length + y.length);
}

const FUZZY_THRESHOLD = 0.72;
const FUZZY_MARGIN = 0.08;

/**
 * Trova la materia dello studente che corrisponde al nome letto dal registro.
 * Restituisce null se non c'è una corrispondenza chiara: meglio far scegliere
 * allo studente che attribuire un voto alla materia sbagliata.
 */
export function matchSubject(guess: string, subjects: ImportSubject[]): ImportSubject | null {
  const q = normalizeName(guess);
  if (!q) return null;

  const exact = subjects.filter((s) => normalizeName(s.name) === q);
  if (exact.length === 1) return exact[0];

  const qTokens = tokens(guess);
  if (qTokens.length) {
    // Stessi termini significativi, in qualunque ordine ("Matematica e Fisica" ≈ "Fisica e Matematica").
    const sameTokens = subjects.filter((s) => {
      const t = tokens(s.name);
      return t.length === qTokens.length && t.every((x) => qTokens.includes(x));
    });
    if (sameTokens.length === 1) return sameTokens[0];
  }

  // Abbreviazioni: "mat", "ital", "ed fisica" → prefisso di un solo nome.
  if (q.replace(/ /g, "").length >= 3) {
    const prefixed = subjects.filter((s) => {
      const name = normalizeName(s.name);
      return name.startsWith(q) || qTokens.every((t) => tokens(s.name).some((u) => u.startsWith(t)));
    });
    if (prefixed.length === 1) return prefixed[0];
  }

  const ranked = subjects
    .map((s) => ({ s, score: similarity(guess, s.name) }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = ranked;
  if (best && best.score >= FUZZY_THRESHOLD && (!second || best.score - second.score >= FUZZY_MARGIN)) return best.s;
  return null;
}

// ─── Date ───────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Interpreta una data scritta come la scrive un registro italiano. Con il solo giorno e mese
 * ("14/10") sceglie l'anno che cade dentro l'anno scolastico.
 */
export function parseImportDate(
  raw: string | null,
  today: DateKey,
  schoolYear: NormalizeContext["schoolYear"],
): DateKey | null {
  if (!raw) return null;
  const text = raw.trim();
  if (isDateKey(text)) return text;

  const m = /^(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?:\s*[/.\-]\s*(\d{2}|\d{4}))?$/.exec(text);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);

  const build = (year: number): DateKey | null => {
    const key = `${year}-${pad(month)}-${pad(day)}`;
    return isDateKey(key) ? key : null;
  };

  if (m[3]) {
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return build(year);
  }

  const startYear = Number((schoolYear?.starts_on ?? today).slice(0, 4));
  const endYear = Number((schoolYear?.ends_on ?? today).slice(0, 4));
  const candidates = [...new Set([startYear, endYear])].map(build).filter((d): d is DateKey => d !== null);
  if (schoolYear) {
    const inside = candidates.find((d) => d >= schoolYear.starts_on && d <= schoolYear.ends_on);
    if (inside) return inside;
  }
  // Senza anno scolastico: l'anno più recente che non finisca nel futuro.
  const past = candidates.filter((d) => d <= today).sort();
  return past.at(-1) ?? candidates[0] ?? null;
}

// ─── Righe ──────────────────────────────────────────────────────────────────

const NOT_A_GRADE = /^(ass|assente|n\.?\s?\/?\s?d|nc|n\.?c\.?|g|gi|giust|ritardo|-+|\/)$/i;

function sameGrade(a: { subjectId: string; date: DateKey; value: number; kind: GradeKind }, b: typeof a): boolean {
  return a.subjectId === b.subjectId && a.date === b.date && a.kind === b.kind && Math.abs(a.value - b.value) < 0.001;
}

export function normalizeExtraction(extracted: ExtractedGrade[], ctx: NormalizeContext): ImportRow[] {
  const seen: { subjectId: string; date: DateKey; value: number; kind: GradeKind }[] = [];

  return extracted.map((item, index) => {
    const issues: string[] = [];
    const subject = matchSubject(item.subject, ctx.subjects);
    const valueText = item.value.trim();
    const kind: GradeKind = item.kind ?? "written";
    const date = parseImportDate(item.date, ctx.today, ctx.schoolYear);

    let value: number | null = null;
    if (NOT_A_GRADE.test(valueText) || valueText === "") {
      issues.push("Non è un voto");
    } else {
      const parsed = parseGrade(valueText, ctx.scale);
      if (parsed.ok) value = parsed.value;
      else {
        issues.push(
          parsed.reason === "range"
            ? "Voto fuori dalla tua scala"
            : parsed.reason === "step"
              ? "La tua scala non ammette questo voto"
              : "Voto non riconosciuto",
        );
      }
    }

    if (!subject) issues.push("Scegli la materia");
    if (!item.date) issues.push("Manca la data");
    else if (!date) issues.push("Data non leggibile");
    else if (date > ctx.today) issues.push("La data è nel futuro");

    let status: RowStatus = issues.length ? "invalid" : "ready";

    if (status === "ready" && subject && date && value !== null) {
      const candidate = { subjectId: subject.id, date, value, kind };
      const duplicate = ctx.existing.some((g) => sameGrade(g, candidate)) || seen.some((g) => sameGrade(g, candidate));
      if (duplicate) {
        status = "duplicate";
        issues.push("Già presente");
      } else {
        seen.push(candidate);
      }
    }

    return {
      key: String(index),
      subjectGuess: item.subject.trim(),
      subjectId: subject?.id ?? null,
      valueText,
      value,
      date,
      kind,
      description: (item.description ?? "").trim().slice(0, 200),
      status,
      issue: issues[0] ?? null,
    };
  });
}
