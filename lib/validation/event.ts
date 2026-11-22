import { z } from "zod";
import { isDateKey } from "@/lib/domain/dates";
import { isTime } from "@/lib/domain/timetable";

export const EVENT_KINDS = ["test", "oral", "project", "homework", "event"] as const;

export const eventInputSchema = z.object({
  title: z.string().trim().min(1, "Scrivi il titolo").max(140, "Massimo 140 caratteri"),
  kind: z.enum(EVENT_KINDS),
  starts_on: z.string().refine(isDateKey, "Data non valida"),
  // Vuoto = tutto il giorno.
  starts_at: z.string().refine((v) => v === "" || isTime(v), "Ora non valida").optional().default(""),
  subject_id: z.string().optional().default(""),
  notes: z.string().trim().max(500, "Massimo 500 caratteri").optional().default(""),
});
export type EventInput = z.infer<typeof eventInputSchema>;
