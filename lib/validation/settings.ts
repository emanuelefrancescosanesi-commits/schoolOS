import { z } from "zod";
import { PERIOD_SCHEMES, profileStepSchema, REGISTRO_OPTIONS, scaleStepSchema, schoolYearStepSchema } from "./onboarding";

/**
 * Validazione delle Impostazioni: riusa gli schemi dell'onboarding, così ciò che si
 * sceglie all'inizio e ciò che si modifica dopo seguono esattamente le stesse regole.
 */

export const settingsProfileSchema = profileStepSchema.extend({ registro: z.enum(REGISTRO_OPTIONS) });
export type SettingsProfileInput = z.infer<typeof settingsProfileSchema>;

export const settingsScaleSchema = scaleStepSchema;
export type SettingsScaleInput = z.infer<typeof settingsScaleSchema>;

export const settingsPeriodsSchema = schoolYearStepSchema;
export type SettingsPeriodsInput = z.infer<typeof settingsPeriodsSchema>;

export const settingsNotificationsSchema = z.object({
  notify_overdue: z.boolean(),
  notify_due_soon: z.boolean(),
  notify_tests: z.boolean(),
  notify_test_days: z.number().int().min(1, "Da 1 a 14 giorni").max(14, "Da 1 a 14 giorni"),
});
export type SettingsNotificationsInput = z.infer<typeof settingsNotificationsSchema>;

export { PERIOD_SCHEMES, REGISTRO_OPTIONS };
