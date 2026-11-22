import { z } from "zod";
import { isDateKey } from "@/lib/domain/dates";

export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Scrivi cosa devi fare").max(140, "Massimo 140 caratteri"),
  subject_id: z.string().optional().default(""),
  kind: z.enum(["homework", "test", "oral", "project"]),
  due_on: z.string().refine(isDateKey, "Data non valida"),
  estimated_minutes: z.coerce.number().int().min(1, "Almeno 1 minuto").max(1440, "Massimo 24 ore").optional(),
});
export type TaskInput = z.infer<typeof taskInputSchema>;
