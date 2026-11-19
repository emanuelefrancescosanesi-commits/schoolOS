import { describe, expect, it } from "vitest";
import { suggestedPeriods } from "@/lib/domain/periods";
import { type OnboardingInput, onboardingSchema, toOnboardingPayload } from "./onboarding";

const valid = (): OnboardingInput => ({
  profile: { first_name: " Sara ", school_name: "", class_name: "3B" },
  year: {
    period_scheme: "trimestre-pentamestre",
    school_year: { label: "2026/27", starts_on: "2026-09-10", ends_on: "2027-06-10" },
    periods: suggestedPeriods("trimestre-pentamestre", 2026).map(({ name, start, end }) => ({
      name,
      starts_on: start,
      ends_on: end,
    })),
  },
  subjects: {
    subjects: [
      { name: "Matematica", color: 2, teacher_name: "" },
      { name: "Italiano", color: 1, teacher_name: "Prof.ssa Neri" },
    ],
  },
  scale: {
    grade_min: 1,
    grade_max: 10,
    allow_half: true,
    allow_plus_minus: true,
    pass_threshold: 6,
    average_method: "weighted",
  },
  registro: { registro: "argo" },
});

describe("onboardingSchema", () => {
  it("accetta una configurazione completa e ripulisce gli spazi", () => {
    const result = onboardingSchema.safeParse(valid());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.profile.first_name).toBe("Sara");
  });

  it("accetta tutti gli schemi di periodi proposti", () => {
    for (const scheme of ["trimestri", "trimestre-pentamestre", "quadrimestri"] as const) {
      const input = valid();
      input.year.period_scheme = scheme;
      input.year.periods = suggestedPeriods(scheme, 2026).map(({ name, start, end }) => ({
        name,
        starts_on: start,
        ends_on: end,
      }));
      expect(onboardingSchema.safeParse(input).success, scheme).toBe(true);
    }
  });

  it("richiede il nome", () => {
    const input = valid();
    input.profile.first_name = "   ";
    expect(onboardingSchema.safeParse(input).error?.issues[0].message).toBe("Scrivi il tuo nome");
  });

  it("rifiuta periodi sovrapposti o fuori dall'anno", () => {
    const overlap = valid();
    overlap.year.periods[1].starts_on = "2026-12-01";
    expect(onboardingSchema.safeParse(overlap).error?.issues[0].message).toMatch(/deve iniziare dopo/);

    const outside = valid();
    outside.year.periods[0].starts_on = "2026-08-01";
    expect(onboardingSchema.safeParse(outside).error?.issues[0].message).toMatch(/esce dall'anno/);
  });

  it("rifiuta materie ripetute, anche con maiuscole diverse", () => {
    const input = valid();
    input.subjects.subjects.push({ name: "matematica ", color: 3, teacher_name: "" });
    expect(onboardingSchema.safeParse(input).error?.issues[0].message).toMatch(/ripetuta/);
  });

  it("rifiuta una sufficienza fuori scala", () => {
    const input = valid();
    input.scale.pass_threshold = 11;
    expect(onboardingSchema.safeParse(input).success).toBe(false);
  });

  it("produce il payload atteso dalla funzione del database", () => {
    const parsed = onboardingSchema.parse(valid());
    const payload = toOnboardingPayload(parsed);
    expect(payload.profile).toMatchObject({ first_name: "Sara", registro: "argo", period_scheme: "trimestre-pentamestre" });
    expect(payload.periods).toHaveLength(2);
    expect(payload.subjects[1]).toEqual({ name: "Italiano", color: 1, teacher_name: "Prof.ssa Neri" });
  });
});
