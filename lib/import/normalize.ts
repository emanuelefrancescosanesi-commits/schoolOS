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
//
// Il confronto dei nomi vive in due posti che devono dare lo stesso risultato: qui (anteprima
// dell'import) e nella funzione SQL `public.match_subject` (sincronizzazione automatica, migrazione
// 20261122110000). Il test `tests/subject-match-sql.test.ts` li fa girare sugli stessi casi.
// Se cambi una regola, cambiala in entrambi.

const STOP_WORDS = new Set([
  "e", "ed", "di", "del", "dell", "della", "dello", "dei", "degli", "delle", "il", "la", "lo", "l", "le", "a", "al", "all",
  "alla", "in", "nel", "nell", "nella", "per", "con", "su", "sul", "sull", "da", "dal", "dalla",
]);

/** Parole di contorno che i registri aggiungono o tolgono ("Lingua e cultura straniera"). */
const NOISE_WORDS = new Set(["lingua", "letteratura", "cultura", "straniera", "straniere", "sportive", "sportiva", "sport"]);

const WORD_ALIASES: Record<string, string> = {
  italiana: "italiano",
  tedesca: "tedesco",
  spagnola: "spagnolo",
  latina: "latino",
  greca: "greco",
  francese: "francese",
};

/** Sinonimi a più parole, applicati sul nome già normalizzato (prima di togliere le parole vuote). */
const PHRASE_RULES: [RegExp, string][] = [
  [/\b(?:ed|educ|educazione) fisica\b/g, "scienze motorie"],
  [/\b(?:ed|educ) (civica|artistica|tecnica|musicale)\b/g, "educazione $1"],
  [/\beducazione alla cittadinanza\b/g, "educazione civica"],
  [/\b(?:insegnamento religione cattolica|insegnamento della religione cattolica|religione cattolica|irc|ire|relig)\b/g, "religione"],
];

/** Minuscolo, senza accenti né punteggiatura: "Storia dell'Arte" → "storia dell arte". */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Termini significativi di una materia, dopo sinonimi e parole vuote. Ordine originale. */
function tokens(name: string): string[] {
  let s = normalizeName(name);
  for (const [re, to] of PHRASE_RULES) s = s.replace(re, to);
  const all = s.split(" ").filter((t) => t && !STOP_WORDS.has(t)).map((t) => WORD_ALIASES[t] ?? t);
  const significant = all.filter((t) => !NOISE_WORDS.has(t));
  return significant.length ? significant : all;
}

/** Chiave canonica: stessi termini, in qualunque ordine, danno la stessa chiave. */
export function subjectKey(name: string): string {
  return tokens(name).sort().join(" ");
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
 *
 * Livelli, dal più sicuro: 1) stessa chiave (maiuscole, accenti, apostrofi, ordine, sinonimi);
 * 2) abbreviazione univoca ("mat", "ital"); 3) nome più corto contenuto in quello più lungo
 * ("Storia dell'arte" ≈ "Disegno e storia dell'arte"), solo con almeno due termini per lato;
 * 4) somiglianza (errori di lettura dell'OCR), solo in anteprima: la sincronizzazione automatica
 * non la usa, perché lì nessuno conferma la riga.
 */
export function matchSubject(guess: string, subjects: ImportSubject[], opts: { fuzzy?: boolean } = {}): ImportSubject | null {
  const fuzzy = opts.fuzzy ?? true;
  const qTokens = tokens(guess);
  if (!qTokens.length) return null;
  const qKey = [...qTokens].sort().join(" ");

  const exact = subjects.filter((s) => subjectKey(s.name) === qKey);
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null;

  // Abbreviazioni: "mat", "ital", "ed fisica" → prefisso (stretto) di un solo nome.
  if (qTokens.join("").length >= 3) {
    const abbreviated = subjects.filter((s) => {
      const st = tokens(s.name);
      return (
        qTokens.every((t) => st.some((u) => u.startsWith(t))) &&
        qTokens.some((t) => st.some((u) => u.length > t.length && u.startsWith(t)))
      );
    });
    if (abbreviated.length === 1) return abbreviated[0];
    if (abbreviated.length > 1) return null;
  }

  // Un nome contiene l'altro: serve almeno una coppia di termini, così "Storia" non si fonde con
  // "Disegno e storia dell'arte".
  const contained = subjects.filter((s) => {
    const st = tokens(s.name);
    if (qTokens.length >= 2 && qTokens.every((t) => st.includes(t))) return true;
    return st.length >= 2 && st.every((t) => qTokens.includes(t));
  });
  if (contained.length === 1) return contained[0];
  if (contained.length > 1) return null;

  if (!fuzzy) return null;
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
