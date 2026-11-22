import { describe, expect, it } from "vitest";
import { countGradesOutsideScale } from "@/lib/domain/grading";
import { settingsNotificationsSchema, settingsPeriodsSchema, settingsProfileSchema, settingsScaleSchema } from "./settings";
import { yearForScheme } from "./onboarding-defaults";

describe("impostazioni · profilo", () => {
  const ok = { first_name: "Sara", school_name: "", class_name: "3B", registro: "axios" } as const;
  it("accetta un profilo valido", () => expect(settingsProfileSchema.safeParse(ok).success).toBe(true));
  it("rifiuta nome vuoto o registro sconosciuto", () => {
    expect(settingsProfileSchema.safeParse({ ...ok, first_name: "  " }).success).toBe(false);
    expect(settingsProfileSchema.safeParse({ ...ok, registro: "mastercom" }).success).toBe(false);
  });
});

describe("impostazioni · scala", () => {
  const ok = { grade_min: 1, grade_max: 10, allow_half: true, allow_plus_minus: true, pass_threshold: 6, average_method: "weighted" } as const;
  it("accetta la scala predefinita", () => expect(settingsScaleSchema.safeParse(ok).success).toBe(true));
  it("rifiuta sufficienza fuori scala", () => expect(settingsScaleSchema.safeParse({ ...ok, pass_threshold: 11 }).success).toBe(false));
  it("rifiuta minimo uguale al massimo", () => expect(settingsScaleSchema.safeParse({ ...ok, grade_min: 10 }).success).toBe(false));
});

describe("impostazioni · periodi", () => {
  for (const scheme of ["trimestri", "trimestre-pentamestre", "quadrimestri"] as const) {
    it(`accetta lo schema proposto per ${scheme}`, () => {
      expect(settingsPeriodsSchema.safeParse(yearForScheme(scheme, 2026)).success).toBe(true);
    });
  }
  it("rifiuta periodi sovrapposti", () => {
    const y = yearForScheme("quadrimestri", 2026);
    y.periods[1].starts_on = y.periods[0].ends_on;
    expect(settingsPeriodsSchema.safeParse(y).success).toBe(false);
  });
  it("rifiuta periodi fuori dall'anno", () => {
    const y = yearForScheme("trimestri", 2026);
    y.school_year.ends_on = "2027-03-01";
    expect(settingsPeriodsSchema.safeParse(y).success).toBe(false);
  });
});

describe("impostazioni · notifiche", () => {
  const ok = { notify_overdue: true, notify_due_soon: false, notify_tests: true, notify_test_days: 3 };
  it("accetta valori validi", () => expect(settingsNotificationsSchema.safeParse(ok).success).toBe(true));
  it("rifiuta anticipo fuori da 1–14", () => {
    expect(settingsNotificationsSchema.safeParse({ ...ok, notify_test_days: 0 }).success).toBe(false);
    expect(settingsNotificationsSchema.safeParse({ ...ok, notify_test_days: 15 }).success).toBe(false);
    expect(settingsNotificationsSchema.safeParse({ ...ok, notify_test_days: 2.5 }).success).toBe(false);
  });
});

describe("cambio scala con voti esistenti", () => {
  const base = { min: 1, max: 10, allowHalf: true, allowPlusMinus: true, passThreshold: 6 };
  it("conta i voti che la nuova scala non ammette", () => {
    const values = [6, 6.5, 7.25, 7.75];
    expect(countGradesOutsideScale(values, base)).toBe(0);
    expect(countGradesOutsideScale(values, { ...base, allowPlusMinus: false })).toBe(2);
    expect(countGradesOutsideScale(values, { ...base, allowHalf: false, allowPlusMinus: false })).toBe(3);
    expect(countGradesOutsideScale([3, 11 - 1], { ...base, min: 4 })).toBe(1);
  });
});
