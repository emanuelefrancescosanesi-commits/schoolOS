import { parseGrade } from "@/lib/domain/grading";
import { DEFAULT_SCALE } from "@/lib/domain/grading";
import { type ExtractedGrade, type GradeKind, matchSubject, normalizeName } from "./normalize";

/**
 * Parser deterministico per il testo copiato dalla pagina dei voti di un registro.
 *
 * Non conosce un layout in particolare: cerca righe con una data e un voto, e prende la materia
 * dalla riga stessa o dall'ultima intestazione di materia sopra di essa. Funziona con elenchi
 * "data · tipo · voto · argomento" in qualunque ordine, raggruppati per materia o con la materia
 * in ogni riga. Non si inventa nulla: ciò che non riconosce viene saltato, e ogni riga trovata
 * passa comunque dall'anteprima dove lo studente conferma.
 *
 * NB: i layout reali di ClasseViva, Argo e Axios vanno verificati con esempi veri; finché non ci
 * sono, questo parser è generico e i test usano formati plausibili, non campioni reali.
 */

const MONTHS: Record<string, number> = {
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, sett: 9, ott: 10, nov: 11, dic: 12,
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6, luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
};

const NUMERIC_DATE = /(?<![\d/.])(\d{1,2})\s*[/.\-]\s*(\d{1,2})(?:\s*[/.\-]\s*(\d{4}|\d{2}))?(?![\d/])/;
const WORD_DATE = new RegExp(
  `(?<![\\d])(\\d{1,2})\\s+(${Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|")})\\.?(?:\\s+(\\d{4}))?(?![a-z])`,
  "i",
);

const KIND_WORDS: [RegExp, GradeKind][] = [
  [/\b(scritto|scritta|compito in classe|verifica scritta|prova scritta)\b/i, "written"],
  [/\b(orale|interrogazione)\b/i, "oral"],
  [/\b(pratico|pratica|grafico|laboratorio|prova pratica)\b/i, "practical"],
];

const GRADE_TOKEN = /^\d{1,2}(?:[.,]\d{1,2})?(?:\s?[+\-−–½])?$/;
const SEPARATORS = /\t+|\s{2,}|\s[|;·•–—-]\s|\||;/;
const IGNORED_LINE = /^(media|totale|periodo|quadrimestre|trimestre|pentamestre|voti|data|materia|tipo|voto|argomento|note)\b/i;

function isoDate(day: number, month: number, year: number | null, contextYear: string | null): string | null {
  const y = year ?? (contextYear ? Number(contextYear) : null);
  if (!y || day < 1 || day > 31 || month < 1 || month > 12) return null;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Estrae la data dalla riga e restituisce il testo senza di essa. Senza anno resta "dd/mm". */
function takeDate(line: string): { date: string | null; rest: string } {
  const word = WORD_DATE.exec(line);
  if (word) {
    const month = MONTHS[word[2].toLowerCase()];
    const date = word[3] ? isoDate(Number(word[1]), month, Number(word[3]), null) : `${String(word[1]).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
    return { date, rest: line.replace(word[0], " ") };
  }
  const num = NUMERIC_DATE.exec(line);
  if (num) {
    const [, d, mo, y] = num;
    const date = y
      ? isoDate(Number(d), Number(mo), y.length === 2 ? 2000 + Number(y) : Number(y), null)
      : `${d.padStart(2, "0")}/${mo.padStart(2, "0")}`;
    return { date, rest: line.replace(num[0], " ") };
  }
  return { date: null, rest: line };
}

function takeKind(text: string): { kind: GradeKind | null; rest: string } {
  for (const [re, kind] of KIND_WORDS) {
    const m = re.exec(text);
    if (m) return { kind, rest: text.replace(m[0], " ") };
  }
  return { kind: null, rest: text };
}

/** Cerca il voto: prima un segmento che sia solo un voto, poi l'unico candidato nella riga. */
function takeGrade(text: string): { value: string | null; rest: string } {
  const segments = text.split(SEPARATORS).map((s) => s.trim()).filter(Boolean);
  const exact = segments.filter((s) => GRADE_TOKEN.test(s) && parseGrade(s, DEFAULT_SCALE).ok);
  if (exact.length >= 1) {
    const chosen = exact.length === 1 ? exact[0] : exact.find((s) => /[+\-−–½.,]/.test(s)) ?? exact[0];
    return { value: chosen, rest: text.replace(chosen, " ") };
  }
  const loose = [...text.matchAll(/(?<![\w/.,])(\d{1,2}(?:[.,]\d{1,2})?(?:\s?[+−–½]|-(?!\w))?)(?![\w/])/g)]
    .map((m) => m[1])
    .filter((v) => parseGrade(v, DEFAULT_SCALE).ok);
  if (loose.length === 1) return { value: loose[0], rest: text.replace(loose[0], " ") };
  return { value: null, rest: text };
}

/**
 * Un'intestazione di materia è una materia nota, oppure una riga tutta maiuscola. Le righe
 * minuscole senza voto sono quasi sempre la coda di un argomento andato a capo.
 */
function isHeading(line: string, known: boolean): boolean {
  if (line.length < 3 || line.length > 60) return false;
  if (/\d/.test(line) || IGNORED_LINE.test(line)) return false;
  if (!/[a-zàèéìòù]/i.test(line)) return false;
  return known || line === line.toUpperCase();
}

export interface ParseContext {
  subjectNames: string[];
  /** Anno da usare per le date scritte senza anno ("14/10"); se manca restano "dd/mm". */
  contextYear?: string | null;
}

/** Legge il testo di un registro; restituisce [] se non riconosce nessun voto. */
export function parseRegistroText(text: string, ctx: ParseContext): ExtractedGrade[] {
  const subjects = ctx.subjectNames.map((name) => ({ id: name, name }));
  const lines = text.split(/\r?\n/).map((l) => l.replace(/ /g, " ").trim()).filter(Boolean).slice(0, 3000);
  const out: ExtractedGrade[] = [];
  let heading = "";

  for (const line of lines) {
    const { date, rest: withoutDate } = takeDate(line);
    const { kind, rest: withoutKind } = takeKind(withoutDate);
    const { value, rest: withoutGrade } = takeGrade(withoutKind);

    if (!date) {
      // Una riga senza data e voto può essere l'intestazione di una materia.
      if (value === null) {
        const known = matchSubject(line, subjects);
        if (isHeading(line, known !== null)) heading = known ? known.name : line;
      }
      continue;
    }

    let gradeText = value;
    if (gradeText === null) {
      // Data e qualcosa che somiglia a un voto ma non lo è (es. "64%" letto male dall'OCR): la
      // mostriamo comunque, come riga da correggere, invece di farla sparire in silenzio.
      const doubtful = /(?<![\w/])\d[\d.,]*\s?[%+\-−–½]?(?![\w/])/.exec(withoutKind);
      if (!doubtful) continue;
      gradeText = doubtful[0].trim();
    }

    // Materia: un segmento della riga che coincide con una materia nota, altrimenti l'intestazione.
    const segments = withoutGrade.split(SEPARATORS).map((s) => s.trim()).filter(Boolean);
    const inline = segments.map((s) => ({ s, hit: matchSubject(s, subjects) })).find((x) => x.hit);
    const subject = inline?.hit?.name ?? heading;

    const description = segments
      .filter((s) => s !== inline?.s)
      .join(" · ")
      .replace(/\s+/g, " ")
      .replace(normalizeName(subject) ? new RegExp("^$") : /$^/, "")
      .trim();

    const resolved = date.includes("-") ? date : ctx.contextYear ? withYear(date, ctx.contextYear) : date;
    out.push({ subject, value: gradeText, date: resolved, kind, description: description || null });
  }
  return out;
}

function withYear(ddmm: string, year: string): string {
  const [d, m] = ddmm.split("/");
  return `${year}-${m}-${d}`;
}
