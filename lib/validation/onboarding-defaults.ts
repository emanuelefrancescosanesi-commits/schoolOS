import type { DateKey } from "@/lib/domain/dates";
import { type PeriodScheme, suggestedPeriods } from "@/lib/domain/periods";
import type { OnboardingInput } from "./onboarding";

/** Materie comuni nelle scuole superiori italiane, proposte come scorciatoia. */
export const COMMON_SUBJECTS = [
  "Italiano",
  "Matematica",
  "Inglese",
  "Storia",
  "Geografia",
  "Filosofia",
  "Fisica",
  "Scienze naturali",
  "Chimica",
  "Latino",
  "Greco",
  "Informatica",
  "Disegno e storia dell'arte",
  "Scienze motorie",
  "Religione",
  "Educazione civica",
  "Diritto ed economia",
  "Economia aziendale",
  "Francese",
  "Spagnolo",
  "Tedesco",
];

/** Anno scolastico che contiene `today` (inizia a settembre). */
export function schoolYearStart(today: DateKey): number {
  const year = Number(today.slice(0, 4));
  return Number(today.slice(5, 7)) >= 8 ? year : year - 1;
}

export function yearForScheme(scheme: PeriodScheme, startYear: number): OnboardingInput["year"] {
  const periods = suggestedPeriods(scheme, startYear);
  return {
    period_scheme: scheme,
    school_year: {
      label: `${startYear}/${String(startYear + 1).slice(2)}`,
      starts_on: periods[0].start,
      ends_on: periods.at(-1)!.end,
    },
    periods: periods.map((p) => ({ name: p.name, starts_on: p.start, ends_on: p.end })),
  };
}

export function initialOnboarding(today: DateKey, firstName: string): OnboardingInput {
  return {
    profile: { first_name: firstName, school_name: "", class_name: "" },
    year: yearForScheme("trimestre-pentamestre", schoolYearStart(today)),
    subjects: { subjects: [] },
    scale: {
      grade_min: 1,
      grade_max: 10,
      allow_half: true,
      allow_plus_minus: true,
      pass_threshold: 6,
      average_method: "weighted",
    },
    registro: { registro: "nessuno" },
  };
}
