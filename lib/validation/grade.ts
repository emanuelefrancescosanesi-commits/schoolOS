import { z } from "zod";
import { isDateKey } from "@/lib/domain/dates";
import { type GradingScale, parseGrade } from "@/lib/domain/grading";

const PARSE_ERRORS = {
  empty: "Scrivi il voto",
  format: "Formato non riconosciuto: prova 7, 7½, 7+ o 7−",
  range: "Voto fuori dalla tua scala",
  step: "La tua scala non ammette questo voto",
} as const;

/** Schema del nuovo voto: il valore è testo libero interpretato con la scala dello studente. */
export function gradeInputSchema(scale: GradingScale) {
  return z.object({
    // L'id è un uuid nel database, una chiave breve nella demo: il formato lo verifica il server.
    subject_id: z.string().min(1, "Scegli una materia"),
    value: z.string().transform((raw, ctx) => {
      const parsed = parseGrade(raw, scale);
      if (!parsed.ok) {
        ctx.addIssue({ code: "custom", message: PARSE_ERRORS[parsed.reason] });
        return z.NEVER;
      }
      return parsed.value;
    }),
    weight: z.coerce.number().gt(0, "Il peso deve essere maggiore di zero").max(10),
    kind: z.enum(["written", "oral", "practical"]),
    graded_on: z.string().refine(isDateKey, "Data non valida"),
    description: z.string().trim().max(200, "Massimo 200 caratteri"),
  });
}

export type GradeInput = z.infer<ReturnType<typeof gradeInputSchema>>;
