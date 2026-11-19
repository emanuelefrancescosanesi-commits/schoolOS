import { z } from "zod";
import { isDateKey } from "@/lib/domain/dates";

/**
 * Validazione dell'onboarding, condivisa tra wizard (client) e Server Action.
 * Il database ricontrolla i vincoli essenziali, ma i messaggi chiari nascono qui.
 */

const dateKey = z.string().refine(isDateKey, "Data non valida");

const trimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label}: massimo ${max} caratteri`);

export const REGISTRO_OPTIONS = ["classeviva", "argo", "axios", "altro", "nessuno"] as const;
export const PERIOD_SCHEMES = ["trimestri", "trimestre-pentamestre", "quadrimestri"] as const;

export const profileStepSchema = z.object({
  first_name: trimmed(60, "Nome").min(1, "Scrivi il tuo nome"),
  school_name: trimmed(120, "Scuola"),
  class_name: trimmed(20, "Classe"),
});

export const periodSchema = z
  .object({
    name: trimmed(40, "Nome del periodo").min(1, "Dai un nome al periodo"),
    starts_on: dateKey,
    ends_on: dateKey,
  })
  .refine((p) => p.ends_on > p.starts_on, { message: "Il periodo deve finire dopo l'inizio", path: ["ends_on"] });

export const schoolYearStepSchema = z
  .object({
    period_scheme: z.enum(PERIOD_SCHEMES),
    school_year: z.object({
      label: trimmed(20, "Anno").min(1),
      starts_on: dateKey,
      ends_on: dateKey,
    }),
    periods: z.array(periodSchema).min(1).max(6),
  })
  .superRefine((value, ctx) => {
    const { school_year: year, periods } = value;
    if (year.ends_on <= year.starts_on) {
      ctx.addIssue({ code: "custom", message: "L'anno deve finire dopo l'inizio", path: ["school_year", "ends_on"] });
    }
    periods.forEach((p, i) => {
      if (p.starts_on < year.starts_on || p.ends_on > year.ends_on) {
        ctx.addIssue({ code: "custom", message: `"${p.name}" esce dall'anno scolastico`, path: ["periods", i] });
      }
      const prev = periods[i - 1];
      if (prev && p.starts_on <= prev.ends_on) {
        ctx.addIssue({
          code: "custom",
          message: `"${p.name}" deve iniziare dopo la fine di "${prev.name}"`,
          path: ["periods", i, "starts_on"],
        });
      }
    });
  });

export const subjectSchema = z.object({
  name: trimmed(60, "Materia").min(1, "Nome della materia mancante"),
  color: z.number().int().min(1).max(8),
  teacher_name: trimmed(80, "Docente"),
});

export const subjectsStepSchema = z.object({
  subjects: z
    .array(subjectSchema)
    .min(1, "Aggiungi almeno una materia")
    .max(30, "Massimo 30 materie")
    .superRefine((subjects, ctx) => {
      const seen = new Set<string>();
      subjects.forEach((s, i) => {
        const key = s.name.trim().toLocaleLowerCase("it-IT");
        if (seen.has(key)) ctx.addIssue({ code: "custom", message: `"${s.name}" è ripetuta`, path: [i, "name"] });
        seen.add(key);
      });
    }),
});

export const scaleStepSchema = z
  .object({
    grade_min: z.number().min(0).max(10),
    grade_max: z.number().min(0).max(10),
    allow_half: z.boolean(),
    allow_plus_minus: z.boolean(),
    pass_threshold: z.number(),
    average_method: z.enum(["arithmetic", "weighted"]),
  })
  .refine((s) => s.grade_min < s.grade_max, { message: "Il voto minimo deve essere sotto il massimo", path: ["grade_min"] })
  .refine((s) => s.pass_threshold >= s.grade_min && s.pass_threshold <= s.grade_max, {
    message: "La sufficienza deve stare dentro la scala",
    path: ["pass_threshold"],
  });

export const registroStepSchema = z.object({ registro: z.enum(REGISTRO_OPTIONS) });

export const onboardingSchema = z.object({
  profile: profileStepSchema,
  year: schoolYearStepSchema,
  subjects: subjectsStepSchema,
  scale: scaleStepSchema,
  registro: registroStepSchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Converte l'input validato nel payload di public.complete_onboarding. */
export function toOnboardingPayload(input: OnboardingInput) {
  return {
    profile: {
      ...input.profile,
      ...input.scale,
      registro: input.registro.registro,
      period_scheme: input.year.period_scheme,
    },
    school_year: input.year.school_year,
    periods: input.year.periods,
    subjects: input.subjects.subjects,
  };
}

/** Primo messaggio d'errore leggibile di un risultato Zod. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Dati non validi";
}
