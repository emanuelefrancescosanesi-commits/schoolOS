import { type DateKey, isDateKey } from "@/lib/domain/dates";
import { type GradingScale, parseGrade } from "@/lib/domain/grading";
import type { ImportRow } from "./normalize";

export type Draft = ImportRow & { selected: boolean };

/** Motivo per cui una riga non si può importare così com'è, o `null` se è a posto. */
export function rowProblem(row: Draft, scale: GradingScale, today: DateKey, hasSubject: (id: string) => boolean): string | null {
  if (!row.subjectId || !hasSubject(row.subjectId)) return "Scegli la materia";
  const parsed = parseGrade(row.valueText, scale);
  if (!parsed.ok) return "Voto non valido per la tua scala";
  if (!row.date || !isDateKey(row.date)) return "Data non valida";
  if (row.date > today) return "La data è nel futuro";
  return null;
}

export interface ReviewSummary {
  total: number;
  /** Righe selezionate e valide: sono quelle che verranno salvate. */
  importable: number;
  /** Righe che il server riconosce già presenti. */
  duplicates: number;
  /** Righe da correggere prima di poterle importare. */
  toFix: number;
}

export function summarizeRows(rows: readonly Draft[], problemOf: (row: Draft) => string | null): ReviewSummary {
  let importable = 0;
  let duplicates = 0;
  let toFix = 0;
  for (const r of rows) {
    const issue = problemOf(r);
    if (issue) toFix++;
    else if (r.status === "duplicate") duplicates++;
    if (!issue && r.selected) importable++;
  }
  return { total: rows.length, importable, duplicates, toFix };
}

/** Seleziona tutte le righe valide (con `onlyNew` salta i duplicati) e deseleziona le altre. */
export function selectRows(rows: readonly Draft[], problemOf: (row: Draft) => string | null, onlyNew: boolean): Draft[] {
  return rows.map((r) => ({ ...r, selected: !problemOf(r) && !(onlyNew && r.status === "duplicate") }));
}
