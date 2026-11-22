import type { Grade } from "@/lib/domain/averages";
import { type GradingScale, formatGrade } from "@/lib/domain/grading";
import type { Subject } from "@/lib/domain/model";

const KIND_IT = { written: "Scritto", oral: "Orale", practical: "Pratico" } as const;
const HEADER = ["Data", "Materia", "Voto", "Tipo", "Peso", "Argomento"];

/** Una cella che inizia con = + − @ verrebbe eseguita come formula da Excel/Fogli: la neutralizziamo. */
function cell(raw: string): string {
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return /[;"\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

/**
 * Voti in CSV per Excel italiano: separatore «;», decimali con la virgola, BOM per gli accenti.
 * Ordinati dal più recente.
 */
export function gradesToCsv(grades: readonly Grade[], subjects: readonly Subject[], scale: GradingScale): string {
  const names = new Map(subjects.map((s) => [s.id, s.name]));
  const rows = [...grades]
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
    .map((g) =>
      [
        g.date,
        names.get(g.subjectId) ?? "",
        formatGrade(g.value, scale),
        KIND_IT[g.kind],
        String(g.weight).replace(".", ","),
        g.description ?? "",
      ]
        .map(cell)
        .join(";"),
    );
  return `﻿${[HEADER.join(";"), ...rows].join("\r\n")}\r\n`;
}

export type GradeSort = "date" | "value";

export function sortGrades<T extends Pick<Grade, "date" | "value" | "id">>(list: readonly T[], sort: GradeSort): T[] {
  return [...list].sort((a, b) =>
    sort === "value" ? b.value - a.value || b.date.localeCompare(a.date) : b.date.localeCompare(a.date) || a.id.localeCompare(b.id),
  );
}
